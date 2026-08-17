import { safeNormalizeOrgRole } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { fetchClerkMembershipRole } from "../employees/employee.clerk.js";
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

  // Trigger only: re-read Clerk for the role so out-of-order Svix deliveries
  // converge; the request path never heals role from the JWT. The write below is
  // guarded by the same clerk_role_updated_at marker employee.role.service.ts
  // uses, so a duplicate/out-of-order delivery can never overwrite a role a
  // newer read (webhook or direct role change) already wrote.
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

    const current = await fetchClerkMembershipRole(clerkOrgId, clerkUserId);

    // Membership is gone in Clerk; the deleted webhook is the channel for that.
    if (!current) {
      return;
    }

    await employeeRepository.updateRoleFromClerkByIdAndOrganization(
      db,
      row.organizationId,
      row.membership.id,
      safeNormalizeOrgRole(current.role),
      current.updatedAt,
    );

    await membershipCache.invalidate(clerkOrgId, clerkUserId);
  },
};
