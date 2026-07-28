import type { Db } from "../../core/db/client.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import { tenantService } from "../tenant/tenant.service.js";
import { tenantCache } from "../tenant/tenant-cache.js";

export const clerkWebhookService = {
  async handleOrganizationCreated(
    db: Db,
    clerkOrgId: string,
    name: string,
  ): Promise<void> {
    await tenantService.provisionTenant(db, clerkOrgId, name || "Organization");
  },

  async handleOrganizationUpdated(
    db: Db,
    clerkOrgId: string,
    name: string,
  ): Promise<void> {
    const updated = await organizationRepository.updateNameByClerkOrgId(
      db,
      clerkOrgId,
      name,
    );

    if (!updated) {
      await tenantService.provisionTenant(db, clerkOrgId, name || "Organization");
      return;
    }

    await tenantCache.invalidate(clerkOrgId);
    await tenantService.warmCache(db, clerkOrgId);
  },

  async handleOrganizationDeleted(db: Db, clerkOrgId: string): Promise<void> {
    await organizationRepository.softDeleteByClerkOrgId(db, clerkOrgId);
    await tenantCache.invalidate(clerkOrgId);
  },
};
