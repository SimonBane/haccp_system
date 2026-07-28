import type { OrganizationResponse } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { logger } from "../../lib/logger.js";

export async function enrichOrganizationFromClerk(
  organization: OrganizationResponse,
): Promise<OrganizationResponse> {
  try {
    const clerkOrg = await clerkClient.organizations.getOrganization({
      organizationId: organization.clerkOrgId,
    });

    return {
      ...organization,
      imageUrl: clerkOrg.imageUrl,
      hasImage: clerkOrg.hasImage,
    };
  } catch (err) {
    logger.warn(
      { err, clerkOrgId: organization.clerkOrgId },
      "Failed to enrich organization from Clerk",
    );
    return organization;
  }
}
