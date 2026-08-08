import { userService } from "../users/user.service.js";
import { userRepository } from "../users/user.repository.js";
import { membershipService } from "../memberships/membership.service.js";
import { provisioningService } from "../provisioning/provisioning.service.js";
import { tenantService } from "../tenant/tenant.service.js";
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

    if (updated) {
      await tenantService.warmCache(db, clerkOrgId);
    }
  },

  async handleOrganizationDeleted(db: Db, clerkOrgId: string): Promise<void> {
    await organizationRepository.softDeleteByClerkOrgId(db, clerkOrgId);
    await tenantService.invalidateCache(clerkOrgId);
  },

  async handleUserUpdated(
    db: Db,
    clerkUserId: string,
    data: Parameters<typeof extractClerkProfile>[0],
  ): Promise<void> {
    await userService.syncUserFromClerk(db, clerkUserId, extractClerkProfile(data));
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
    await membershipService.removeByClerkIds(db, clerkOrgId, clerkUserId);
  },

  // Fallback for the request path: same provisioning code, triggered by the event
  // instead of by a request. Whichever arrives first wins; the other adopts it.
  async handleMembershipCreated(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    role: string,
  ): Promise<void> {
    const tenant = await tenantService.ensureTenant(db, clerkOrgId);
    await provisioningService.ensureMembership(db, {
      tenant,
      clerkUserId,
      orgRole: role,
    });
  },

  async handleMembershipUpdated(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    role: string,
  ): Promise<void> {
    await membershipService.syncRoleByClerkIds(
      db,
      clerkOrgId,
      clerkUserId,
      role,
    );
  },
};
