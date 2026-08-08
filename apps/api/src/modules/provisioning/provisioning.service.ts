import type { UserResponse } from "@haccp/shared";
import { ORG_ROLE, safeNormalizeOrgRole } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { callClerk } from "../../core/auth/clerk-errors.js";
import type { Db } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import {
  ForbiddenError,
  InternalError,
} from "../../core/errors/app-errors.js";
import { isContention } from "../../lib/db-errors.js";
import { logger } from "../../lib/logger.js";
import { singleFlight } from "../../lib/single-flight.js";
import type { MembershipContextRow } from "../employees/employee.repository.js";
import { employeeRepository } from "../employees/employee.repository.js";
import type { MembershipCacheBlob } from "../employees/membership-cache.js";
import { membershipCache } from "../employees/membership-cache.js";
import type { ResolvedTenant } from "../tenant/tenant.service.js";
import { tenantCache } from "../tenant/tenant-cache.js";
import { tenantService, toTenantContext } from "../tenant/tenant.service.js";
import { mapClerkApiUserToProfileData } from "../users/user.mapper.js";
import { userCache } from "../users/user-cache.js";
import { userService } from "../users/user.service.js";
import {
  activateMembership,
  provisionNewMembership,
} from "./provisioning.membership.js";

export type RequestIdentity = {
  clerkOrgId: string;
  clerkUserId: string;
  orgRole: string | null;
};

export type ResolvedRequestContext = {
  tenant: ResolvedTenant;
  user: UserResponse;
  membership: MembershipCacheBlob;
};

export function toBlob(row: MembershipContextRow): MembershipCacheBlob {
  return {
    membershipId: row.membership.id,
    organizationId: row.membership.organizationId,
    userId: row.user.id,
    role: safeNormalizeOrgRole(row.membership.role),
    locationIds: row.locationIds,
  };
}

// Role is deliberately not part of this check. Correcting drift here would let a
// stale token (valid for up to ~60s after a demotion through our own UI) rewrite
// the role back on every request. The organizationMembership.updated webhook is
// the correction channel instead.
export function isHealthy(row: MembershipContextRow): boolean {
  if (
    row.membership.deletedAt !== null ||
    row.user.deletedAt !== null ||
    row.user.clerkUserId === null ||
    row.membership.status !== MEMBERSHIP_STATUS.ACTIVE
  ) {
    return false;
  }

  // Admins reach every location, so they legitimately carry no assignments.
  return (
    row.membership.role === ORG_ROLE.ADMIN || row.locationIds.length > 0
  );
}

async function fetchClerkProfile(clerkUserId: string) {
  const clerkUser = await callClerk(clerkClient.users.getUser(clerkUserId), {
    notFoundMessage: "Your account is no longer available",
    notFoundLog: "Clerk user not found during provisioning",
    failureLog: "Clerk user lookup failed",
    logContext: { clerkUserId },
  });

  const profileData = mapClerkApiUserToProfileData(clerkUserId, clerkUser);

  if (!profileData.email) {
    throw new ForbiddenError(
      "Your account has no verified email address. Contact your administrator.",
    );
  }

  return profileData;
}

export const provisioningService = {
  async ensureMembership(
    db: Db,
    input: {
      tenant: ResolvedTenant;
      clerkUserId: string;
      orgRole: string | null;
    },
  ): Promise<MembershipCacheBlob> {
    const { tenant, clerkUserId, orgRole } = input;
    const clerkOrgId = tenant.organization.clerkOrgId;

    return singleFlight(
      `membership:${clerkOrgId}:${clerkUserId}`,
      async () => {
        const role = safeNormalizeOrgRole(orgRole);

        let row = await employeeRepository.findMembershipContextByClerkUserId(
          db,
          tenant.organizationId,
          clerkUserId,
        );

        if (row && isHealthy(row)) {
          const blob = toBlob(row);
          // The user row came back on this query's inner join, so cache it here
          // rather than letting resolveRequestContext re-SELECT what we already
          // hold. isHealthy guarantees a non-null clerkUserId.
          await Promise.all([
            membershipCache.set(clerkOrgId, clerkUserId, blob),
            userService.cacheUser(row.user),
          ]);
          return blob;
        }

        const profileData = await fetchClerkProfile(clerkUserId);

        // Falls back to email because an admin-created draft has no clerkUserId
        // yet — that is the only link between the invite and the person signing in.
        row ??= await employeeRepository.findMembershipContextByEmail(
          db,
          tenant.organizationId,
          profileData.email,
        );

        const provisionInput = {
          organizationId: tenant.organizationId,
          profileData,
          role,
          tenantLocations: tenant.locations,
        };

        let result;

        try {
          result = await db.transaction(async (tx) =>
            row
              ? activateMembership(tx, { ...provisionInput, row })
              : provisionNewMembership(tx, provisionInput),
          );
        } catch (error) {
          if (!isContention(error)) {
            throw error;
          }

          // Lost the race. Postgres blocks the loser until the winner commits, so
          // the winning row is guaranteed visible now. Re-read once, never loop.
          const settled =
            await employeeRepository.findMembershipContextByClerkUserId(
              db,
              tenant.organizationId,
              clerkUserId,
            );

          if (!settled || !isHealthy(settled)) {
            throw new InternalError(
              "Failed to link your account to this organization",
            );
          }

          await membershipCache.set(clerkOrgId, clerkUserId, toBlob(settled));
          return toBlob(settled);
        }

        const blob = toBlob(result);

        await Promise.all([
          membershipCache.set(clerkOrgId, clerkUserId, blob),
          userService.cacheUser(result.user),
        ]);

        logger.info(
          { clerkOrgId, clerkUserId, action: result.action },
          "Membership provisioned",
        );

        return blob;
      },
    );
  },

  async resolveRequestContext(
    db: Db,
    identity: RequestIdentity,
  ): Promise<ResolvedRequestContext> {
    const { clerkOrgId, clerkUserId, orgRole } = identity;

    // One pipelined Redis round trip. Every key is derivable from the JWT alone,
    // which is why all three can be read before anything else resolves.
    const [tenantBlob, userBlob, membershipBlob] = await Promise.all([
      tenantCache.get(clerkOrgId),
      userCache.get(clerkUserId),
      membershipCache.get(clerkOrgId, clerkUserId),
    ]);

    // The cold entry points, since the cache reads above already missed —
    // ensureTenant/resolveUser would each re-read and miss again.
    const tenant = tenantBlob
      ? toTenantContext(tenantBlob)
      : await tenantService.provisionTenantOnMiss(db, clerkOrgId);

    const membership =
      membershipBlob ??
      (await provisioningService.ensureMembership(db, {
        tenant,
        clerkUserId,
        orgRole,
      }));

    // Deliberately sequential. These look independent, but ensureMembership's
    // query inner-joins users and now caches that row, so running them together
    // would issue a second SELECT for something the first one already fetched.
    //
    // Which resolver to use therefore depends on whether membership was warm:
    // if it was, nothing has populated the user cache and reading it again is a
    // guaranteed miss; if it was cold, ensureMembership has very likely just
    // filled it, and the cache-aware path turns a query into a Redis hit.
    let user =
      userBlob ??
      (membershipBlob
        ? await userService.resolveUserFromDb(db, clerkUserId)
        : await userService.resolveUser(db, clerkUserId));

    if (!user) {
      // Membership cache was warm but the user row is gone or tombstoned.
      // Provisioning restores it rather than failing a request Clerk vouches for.
      await provisioningService.ensureMembership(db, {
        tenant,
        clerkUserId,
        orgRole,
      });
      user = await userService.resolveUser(db, clerkUserId);
    }

    if (!user) {
      throw new InternalError("User not resolved after provisioning");
    }

    return { tenant, user, membership };
  },
};
