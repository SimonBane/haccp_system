import { safeNormalizeOrgRole } from "@haccp/shared";
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

  // Correction channel for role changes made directly in the Clerk Dashboard.
  // The request path never rewrites role on its own, to avoid a stale token
  // flapping a change our own UI just made.
  async syncRoleByClerkIds(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    role: string,
  ): Promise<void> {
    const row = await employeeRepository.findMembershipByClerkIds(
      db,
      clerkOrgId,
      clerkUserId,
    );

    if (!row) {
      return;
    }

    const nextRole = safeNormalizeOrgRole(role);

    if (row.membership.role !== nextRole) {
      await employeeRepository.updateById(db, row.membership.id, {
        role: nextRole,
      });
    }

    await membershipCache.invalidate(clerkOrgId, clerkUserId);
  },
};
