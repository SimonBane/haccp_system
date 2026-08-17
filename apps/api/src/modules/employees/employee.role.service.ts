import type { AppLocale, EmployeeResponse, LocationResponse, OrgRole } from "@haccp/shared";
import {
  normalizeOrgRole,
  ORG_ROLE,
  pickDefaultLocation,
  safeNormalizeOrgRole,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  RoleProjectionFailedError,
  RoleUpdateOutcomeUnknownError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { logRoleChange } from "./employee.audit.js";
import {
  fetchClerkMembershipRole,
  revokeClerkUserSessions,
  updateClerkMembershipRole,
} from "./employee.clerk.js";
import { issueMembershipInvitation } from "./employee.invitations.js";
import type { EmployeeDetail } from "./employee.mapper.js";
import { buildEmployeeResponseFromDetail } from "./employee.mapper.js";
import { employeeRepository } from "./employee.repository.js";
import { membershipCache } from "./membership-cache.js";

async function requireEmployeeDetail(
  db: Db,
  organizationId: string,
  membershipId: string,
): Promise<EmployeeDetail> {
  const detail = await employeeRepository.findDetailById(
    db,
    organizationId,
    membershipId,
  );

  if (!detail) {
    throw new NotFoundError("Employee not found");
  }

  return detail;
}

type ActorContext = {
  actorUserDbId: string;
  actorClerkUserId: string;
};

/**
 * Clerk-first for an active membership: call Clerk, resolve an ambiguous outcome by
 * re-reading Clerk (never by assuming success or failure), then write the local
 * projection from whatever Clerk actually confirms. Always calls Clerk even if the
 * local row already holds the requested role — an idempotent Clerk update is what
 * lets a retry converge instead of no-op'ing against stale local state (HACCP-56 §4).
 */
async function changeActiveRole(
  db: Db,
  organizationId: string,
  clerkOrgId: string,
  actor: ActorContext,
  detail: EmployeeDetail,
  requestedRole: OrgRole,
  tenantLocations: LocationResponse[],
): Promise<EmployeeResponse> {
  const clerkUserId = detail.user.clerkUserId;

  if (!clerkUserId) {
    throw new InternalError("Active employee is missing a Clerk identity");
  }

  const previousRole = normalizeOrgRole(detail.membership.role);
  const logBase = {
    actorUserDbId: actor.actorUserDbId,
    actorClerkUserId: actor.actorClerkUserId,
    organizationId,
    membershipId: detail.membership.id,
    targetClerkUserId: clerkUserId,
    previousRole,
    requestedRole,
  };

  let confirmed: { role: string; updatedAt: Date };

  try {
    confirmed = await updateClerkMembershipRole(
      clerkOrgId,
      clerkUserId,
      requestedRole,
    );
  } catch (error) {
    if (!(error instanceof RoleUpdateOutcomeUnknownError)) {
      logRoleChange({ ...logBase, stage: "rejected" });
      throw error;
    }

    // Timeout/network/5xx on the write itself: do not guess. Re-read is the only
    // source of truth for whether Clerk applied it.
    const current = await fetchClerkMembershipRole(clerkOrgId, clerkUserId).catch(
      () => null,
    );

    if (!current || safeNormalizeOrgRole(current.role) !== requestedRole) {
      logRoleChange({ ...logBase, stage: "outcome_unknown" });
      throw new RoleUpdateOutcomeUnknownError();
    }

    confirmed = current;
  }

  const authoritativeRole = safeNormalizeOrgRole(confirmed.role);
  let response: EmployeeResponse;

  try {
    response = await db.transaction(async (tx) => {
      const updated = await employeeRepository.updateRoleFromClerkByIdAndOrganization(
        tx,
        organizationId,
        detail.membership.id,
        authoritativeRole,
        confirmed.updatedAt,
      );

      // A null result means either a newer Clerk read already won the race (fine —
      // converge to whatever is there now) or the row is gone. Re-read rather than
      // assume either way; only a missing row is a genuine projection failure.
      let membershipRow = updated;

      if (!membershipRow) {
        const refreshed = await employeeRepository.findDetailById(
          tx,
          organizationId,
          detail.membership.id,
        );

        if (!refreshed) {
          throw new RoleProjectionFailedError();
        }

        membershipRow = refreshed.membership;
      }

      let locationIds = detail.locationIds;

      // Promotion keeps existing location rows untouched (admin `[]` reads as "every
      // location" regardless of stored rows). Demotion assigns the default only if
      // the membership is left with none — otherwise a fresh employee-role JWT would
      // 403 with "No locations assigned" for the token's remaining lifetime.
      if (authoritativeRole !== ORG_ROLE.ADMIN && detail.locationIds.length === 0) {
        if (tenantLocations.length === 0) {
          throw new ValidationError(
            "This organization has no locations to assign.",
          );
        }

        locationIds = [pickDefaultLocation(tenantLocations).id];
        await employeeRepository.replaceLocationAssignments(
          tx,
          detail.membership.id,
          organizationId,
          locationIds,
        );
      }

      return buildEmployeeResponseFromDetail(detail, tenantLocations, {
        membership: membershipRow,
        locationIds,
      });
    });

    logRoleChange({ ...logBase, stage: "applied", authoritativeRole });
  } catch (error) {
    logRoleChange({ ...logBase, stage: "projection_failed", authoritativeRole });

    if (error instanceof RoleProjectionFailedError) {
      throw error;
    }

    throw new RoleProjectionFailedError();
  } finally {
    // Unconditional, same as the PR1 fix to update()/remove(): a failure above this
    // line must never leave the cache pinned to the pre-change role.
    await membershipCache.invalidate(clerkOrgId, clerkUserId);
  }

  // Outside the try/catch on purpose: the projection already committed above, so
  // a failure here (revokeClerkUserSessions never actually throws, but nothing
  // guarantees that forever) must surface as its own error rather than being
  // relabeled RoleProjectionFailedError against a projection that in fact succeeded.
  if (previousRole === ORG_ROLE.ADMIN && authoritativeRole !== ORG_ROLE.ADMIN) {
    await revokeClerkUserSessions(clerkUserId);
  }

  return response;
}

async function changeDraftRole(
  db: Db,
  organizationId: string,
  actor: ActorContext,
  detail: EmployeeDetail,
  requestedRole: OrgRole,
  tenantLocations: LocationResponse[],
): Promise<EmployeeResponse> {
  const previousRole = normalizeOrgRole(detail.membership.role);

  if (previousRole === requestedRole) {
    return buildEmployeeResponseFromDetail(detail, tenantLocations);
  }

  // No Clerk identity exists yet for a draft — a plain local write.
  const updated = await employeeRepository.updateByIdAndOrganization(
    db,
    organizationId,
    detail.membership.id,
    { role: requestedRole },
  );

  if (!updated) {
    throw new NotFoundError("Employee not found");
  }

  logRoleChange({
    actorUserDbId: actor.actorUserDbId,
    actorClerkUserId: actor.actorClerkUserId,
    organizationId,
    membershipId: detail.membership.id,
    targetClerkUserId: null,
    previousRole,
    requestedRole,
    authoritativeRole: requestedRole,
    stage: "applied",
  });

  return buildEmployeeResponseFromDetail(detail, tenantLocations, {
    membership: updated,
  });
}

async function changeInvitedRole(
  db: Db,
  organizationId: string,
  clerkOrgId: string,
  orgLocale: AppLocale,
  actor: ActorContext,
  detail: EmployeeDetail,
  requestedRole: OrgRole,
  tenantLocations: LocationResponse[],
): Promise<EmployeeResponse> {
  const previousRole = normalizeOrgRole(detail.membership.role);

  if (previousRole === requestedRole) {
    return buildEmployeeResponseFromDetail(detail, tenantLocations);
  }

  if (!detail.membership.clerkInvitationId) {
    throw new InternalError("Invited employee is missing a Clerk invitation");
  }

  // The role lives on the Clerk invitation, which cannot be edited in place —
  // revoking and reissuing is the only way to change it before acceptance.
  const membership = await issueMembershipInvitation(
    db,
    organizationId,
    detail.membership.id,
    {
      locale: orgLocale,
      clerkOrgId,
      inviterUserId: actor.actorClerkUserId,
      email: detail.user.email,
      role: requestedRole,
      firstName: detail.user.firstName,
      lastName: detail.user.lastName,
    },
    { previousInvitationId: detail.membership.clerkInvitationId },
  );

  logRoleChange({
    actorUserDbId: actor.actorUserDbId,
    actorClerkUserId: actor.actorClerkUserId,
    organizationId,
    membershipId: detail.membership.id,
    targetClerkUserId: detail.user.clerkUserId,
    previousRole,
    requestedRole,
    authoritativeRole: requestedRole,
    stage: "applied",
  });

  return buildEmployeeResponseFromDetail(detail, tenantLocations, { membership });
}

export const employeeRoleService = {
  async changeRole(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    orgLocale: AppLocale,
    actor: ActorContext,
    membershipId: string,
    requestedRole: OrgRole,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(db, organizationId, membershipId);

    if (detail.membership.userId === actor.actorUserDbId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    const currentRole = normalizeOrgRole(detail.membership.role);
    const isDemotingActiveAdmin =
      detail.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
      currentRole === ORG_ROLE.ADMIN &&
      requestedRole !== ORG_ROLE.ADMIN;

    if (isDemotingActiveAdmin) {
      const remainingAdmins = await employeeRepository.countActiveAdmins(
        db,
        organizationId,
        membershipId,
      );

      if (remainingAdmins === 0) {
        throw new ValidationError(
          "The organization must keep at least one admin.",
        );
      }
    }

    if (detail.membership.status === MEMBERSHIP_STATUS.ACTIVE) {
      return changeActiveRole(
        db,
        organizationId,
        clerkOrgId,
        actor,
        detail,
        requestedRole,
        tenantLocations,
      );
    }

    if (detail.membership.status === MEMBERSHIP_STATUS.INVITED) {
      return changeInvitedRole(
        db,
        organizationId,
        clerkOrgId,
        orgLocale,
        actor,
        detail,
        requestedRole,
        tenantLocations,
      );
    }

    return changeDraftRole(
      db,
      organizationId,
      actor,
      detail,
      requestedRole,
      tenantLocations,
    );
  },
};
