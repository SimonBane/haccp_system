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

  /**
   * Correction channel for role changes made directly in the Clerk Dashboard.
   * The request path never rewrites role on its own, to avoid a stale token
   * flapping a change our own UI just made.
   *
   * The event is treated as a trigger, not as data: Svix gives no ordering
   * guarantee, so trusting the role in the payload lets a promote delivered
   * after a demote reinstate an admin permanently. Re-reading Clerk means both
   * deliveries converge on the same answer whichever order they arrive in.
   * Comparing the event's `updated_at` against our row's would not work — those
   * are two different clocks, and our write always lands after the event.
   */
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

    // Nothing to correct yet. The request path provisions with the role off the
    // caller's own token, so an out-of-order `.updated` needs no handling here.
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
