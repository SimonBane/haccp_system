import { userService } from "../users/user.service.js";
import { userRepository } from "../users/user.repository.js";
import { membershipWebhookService } from "../employees/employee.service.js";
import { tenantService } from "../tenant/tenant.service.js";
import { tenantCache } from "../tenant/tenant-cache.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import { extractClerkProfile } from "../users/user.mapper.js";
import type { Db } from "../../core/db/client.js";

type OrganizationWebhookData = {
  name: string;
  imageUrl: string;
  hasImage: boolean;
};

export const clerkWebhookService = {
  async handleOrganizationCreated(
    db: Db,
    clerkOrgId: string,
    data: OrganizationWebhookData,
  ): Promise<void> {
    await tenantService.provisionTenant(db, clerkOrgId, {
      name: data.name || "Organization",
      imageUrl: data.imageUrl,
      hasImage: data.hasImage,
    });
  },

  async handleOrganizationUpdated(
    db: Db,
    clerkOrgId: string,
    data: OrganizationWebhookData,
  ): Promise<void> {
    const updated = await organizationRepository.updateByClerkOrgId(
      db,
      clerkOrgId,
      {
        name: data.name,
        imageUrl: data.imageUrl,
        hasImage: data.hasImage,
      },
    );

    if (!updated) {
      await tenantService.provisionTenant(db, clerkOrgId, {
        name: data.name || "Organization",
        imageUrl: data.imageUrl,
        hasImage: data.hasImage,
      });
      return;
    }

    await tenantCache.invalidate(clerkOrgId);
  },

  async handleOrganizationDeleted(db: Db, clerkOrgId: string): Promise<void> {
    await organizationRepository.softDeleteByClerkOrgId(db, clerkOrgId);
    await tenantCache.invalidate(clerkOrgId);
  },

  async handleUserUpdated(
    db: Db,
    clerkUserId: string,
    data: Parameters<typeof extractClerkProfile>[0],
  ): Promise<void> {
    await userService.syncUserFromClerkWebhook(db, clerkUserId, data);
  },

  async handleUserDeleted(db: Db, clerkUserId: string): Promise<void> {
    await userRepository.softDeleteByClerkUserId(db, clerkUserId);
    await userService.invalidateCache(clerkUserId);
  },

  async handleMembershipDeleted(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<void> {
    await membershipWebhookService.removeMembership(db, clerkOrgId, clerkUserId);
  },

  async handleInvitationAccepted(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    email: string,
    role: string,
    clerkInvitationId: string,
    profile: Parameters<typeof extractClerkProfile>[0],
  ): Promise<void> {
    await membershipWebhookService.linkMembershipFromClerk(
      db,
      clerkOrgId,
      clerkUserId,
      email,
      role,
      clerkInvitationId,
      extractClerkProfile(profile),
    );
  },

  async handleInvitationRevoked(
    db: Db,
    clerkInvitationId: string,
  ): Promise<void> {
    await membershipWebhookService.handleInvitationRevoked(
      db,
      clerkInvitationId,
    );
  },
};
