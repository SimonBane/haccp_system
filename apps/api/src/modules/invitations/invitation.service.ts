import type { Db } from "../../core/db/client.js";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { NotFoundError } from "../../core/errors/app-errors.js";
import { membershipWebhookService } from "../employees/employee.service.js";
import { employeeRepository } from "../employees/employee.repository.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import { mapClerkApiUserToProfile } from "../users/user.mapper.js";

export const invitationService = {
  async accept(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    orgRole: string,
  ): Promise<void> {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const profile = mapClerkApiUserToProfile(clerkUser);

    if (!profile.email) {
      throw new NotFoundError("User email not found");
    }

    const membershipRow = await employeeRepository.findByEmail(
      db,
      organization.id,
      profile.email,
    );

    await membershipWebhookService.linkMembershipFromClerk(
      db,
      clerkOrgId,
      clerkUserId,
      profile.email,
      orgRole,
      membershipRow?.membership.clerkInvitationId ?? null,
      profile,
    );
  },
};
