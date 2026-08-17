import type { AppLocale } from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import { ValidationError } from "../../core/errors/app-errors.js";
import { revokeClerkInvitation, sendClerkInvitation } from "./employee.clerk.js";
import { employeeRepository } from "./employee.repository.js";

export type InviteEmployeeParams = {
  locale: AppLocale;
  clerkOrgId: string;
  inviterUserId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
};

export async function issueMembershipInvitation(
  db: Db | DbClient,
  organizationId: string,
  membershipId: string,
  params: InviteEmployeeParams,
  options: { previousInvitationId?: string } = {},
): Promise<OrganizationMembership> {
  const isReissue = options.previousInvitationId !== undefined;

  if (options.previousInvitationId) {
    await revokeClerkInvitation(params.clerkOrgId, options.previousInvitationId);
  }

  const invitation = await sendClerkInvitation(
    params.locale,
    params.clerkOrgId,
    params.inviterUserId,
    params.email,
    params.role,
    params.firstName,
    params.lastName,
  );

  const updated = await employeeRepository.updateStatusByIdAndOrganization(
    db,
    organizationId,
    membershipId,
    isReissue ? MEMBERSHIP_STATUS.INVITED : MEMBERSHIP_STATUS.DRAFT,
    {
      status: MEMBERSHIP_STATUS.INVITED,
      // A no-op for create()/invite() (params.role already matches the row); the
      // write that matters is a role reissue via employee.role.service.ts, which
      // otherwise has no other call site that persists the new role locally.
      role: params.role,
      clerkInvitationId: invitation.id,
      invitedAt: new Date(),
    },
  );

  if (!updated) {
    throw new ValidationError(
      isReissue
        ? "Employee does not have a pending invitation"
        : "Only draft employees can be invited",
    );
  }

  return updated;
}
