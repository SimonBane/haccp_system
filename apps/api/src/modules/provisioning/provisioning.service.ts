import type { UserResponse } from "@haccp/shared";
import { ORG_ROLE, safeNormalizeOrgRole } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import {
  clerkErrorStatus,
  withClerkTimeout,
} from "../../core/auth/clerk-errors.js";
import type { Db } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import {
  ForbiddenError,
  InternalError,
  ServiceUnavailableError,
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

function toBlob(row: MembershipContextRow): MembershipCacheBlob {
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
function isHealthy(row: MembershipContextRow): boolean {
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
  let clerkUser;

  try {
    clerkUser = await withClerkTimeout(clerkClient.users.getUser(clerkUserId));
  } catch (error) {
    if (clerkErrorStatus(error) === 404) {
      logger.warn({ clerkUserId }, "Clerk user not found during provisioning");
      throw new ForbiddenError("Your account is no longer available");
    }

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error({ err: error, clerkUserId }, "Clerk user lookup failed");
    throw new ServiceUnavailableError(
      "Could not reach the identity provider. Please try again.",
    );
  }

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
          await membershipCache.set(clerkOrgId, clerkUserId, blob);
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

    const tenant = tenantBlob
      ? toTenantContext(tenantBlob)
      : await tenantService.ensureTenant(db, clerkOrgId);

    const membership =
      membershipBlob ??
      (await provisioningService.ensureMembership(db, {
        tenant,
        clerkUserId,
        orgRole,
      }));

    let user = userBlob ?? (await userService.resolveUser(db, clerkUserId));

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
