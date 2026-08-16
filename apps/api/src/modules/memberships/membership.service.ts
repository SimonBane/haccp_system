import { safeNormalizeOrgRole } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { callClerk } from "../../core/auth/clerk-errors.js";
import type { Db } from "../../core/db/client.js";
import { employeeRepository } from "../employees/employee.repository.js";
import { membershipCache } from "../employees/membership-cache.js";

export const membershipService = {
  async removeByClerkIds(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<void> {
    const row = await employeeRepository.findMembershipByClerkIds(
      db,
      clerkOrgId,
      clerkUserId,
    );

    if (!row) {
      return;
    }

    await employeeRepository.softDeleteById(db, row.membership.id);
    await membershipCache.invalidate(clerkOrgId, clerkUserId);
  },

  /** Trigger only: re-read Clerk for the role so out-of-order Svix deliveries converge. Request path never heals role from the JWT. */
  async syncRoleByClerkIds(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<void> {
    const row = await employeeRepository.findMembershipByClerkIds(
      db,
      clerkOrgId,
      clerkUserId,
    );

    if (!row) {
      return;
    }

    const memberships = await callClerk(
      clerkClient.organizations.getOrganizationMembershipList({
        organizationId: clerkOrgId,
        userId: [clerkUserId],
        limit: 1,
      }),
      {
        notFoundMessage: "This organization is no longer available",
        notFoundLog: "Clerk organization missing while syncing member role",
        failureLog: "Clerk membership lookup failed while syncing role",
        logContext: { clerkOrgId, clerkUserId },
      },
    );

    const current = memberships.data[0];

    // Membership is gone in Clerk; the deleted webhook is the channel for that.
    if (!current) {
      return;
    }

    const nextRole = safeNormalizeOrgRole(current.role);

    if (row.membership.role !== nextRole) {
      await employeeRepository.updateById(db, row.membership.id, {
        role: nextRole,
      });
    }

    await membershipCache.invalidate(clerkOrgId, clerkUserId);
  },
};
