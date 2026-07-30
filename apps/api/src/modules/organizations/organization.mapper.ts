import type { Organization } from "../../core/db/schema/organizations.js";
import type { OrganizationResponse } from "@haccp/shared";

export function toOrganizationResponse(
  organization: Organization,
): OrganizationResponse {
  return {
    id: organization.id,
    clerkOrgId: organization.clerkOrgId,
    name: organization.name,
    imageUrl: organization.imageUrl,
    hasImage: organization.hasImage,
    timezone: organization.timezone,
    locale: organization.locale as OrganizationResponse["locale"],
    multipleLocationsEnabled: organization.multipleLocationsEnabled,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}
