import { safeNormalizeOrgRole, type OrgRole } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { callClerk } from "../../core/auth/clerk-errors.js";
import type { Db } from "../../core/db/client.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import { NotFoundError } from "../../core/errors/app-errors.js";
import { employeeRepository } from "./employee.repository.js";
import { membershipCache } from "./membership-cache.js";

export type ChangeActiveEmployeeRoleParams = {
  organizationId: string;
  clerkOrgId: string;
  clerkUserId: string;
  membershipId: string;
  role: OrgRole;
};

export async function changeActiveEmployeeRole(
  db: Db,
  { organizationId, clerkOrgId, clerkUserId, membershipId, role }: ChangeActiveEmployeeRoleParams,
): Promise<OrganizationMembership> {
  const updated = await callClerk(
    clerkClient.organizations.updateOrganizationMembership({
      organizationId: clerkOrgId,
      userId: clerkUserId,
      role,
    }),
    {
      notFoundMessage: "This employee is no longer a member of the organization",
      notFoundLog: "Clerk organization membership missing while changing role",
      failureLog: "Clerk role update failed",
      logContext: { clerkOrgId, clerkUserId, membershipId },
    },
  );

  const nextRole = safeNormalizeOrgRole(updated.role);

  const membership = await employeeRepository.updateByIdAndOrganization(
    db,
    organizationId,
    membershipId,
    { role: nextRole },
  );

  if (!membership) {
    throw new NotFoundError("Employee not found");
  }

  await membershipCache.invalidate(clerkOrgId, clerkUserId);

  return membership;
}
