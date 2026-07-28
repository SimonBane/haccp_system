import {
  type OrganizationResponse,
  type UpdateOrganizationInput,
  validateOrganizationLogoFile,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { clerkClient } from "../../core/auth/clerk-client.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { locationRepository } from "../locations/location.repository.js";
import { enrichOrganizationFromClerk } from "./organization-clerk.js";
import { toOrganizationResponse } from "./organization.mapper.js";
import { organizationRepository } from "./organization.repository.js";
import { tenantCache } from "../tenant/tenant-cache.js";

function assertValidLogoFile(file: { size: number; type: string }): void {
  const validationError = validateOrganizationLogoFile(file);

  if (validationError === "invalid_type") {
    throw new ValidationError(
      "Logo must be a JPEG, PNG, GIF, or WebP image",
    );
  }

  if (validationError === "too_large") {
    throw new ValidationError("Logo must be 2 MB or smaller");
  }
}

export const organizationService = {
  async updateSettings(
    db: Db,
    clerkOrgId: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationResponse> {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    if (
      input.multipleLocationsEnabled === false &&
      organization.multipleLocationsEnabled
    ) {
      const locationCount = await locationRepository.countByOrganizationId(
        db,
        organization.id,
      );

      if (locationCount > 1) {
        throw new ConflictError(
          "Cannot disable multiple locations while more than one site exists",
        );
      }
    }

    if (input.name !== undefined && input.name !== organization.name) {
      try {
        await clerkClient.organizations.updateOrganization(clerkOrgId, {
          name: input.name,
        });
      } catch {
        throw new InternalError("Failed to update organization name in Clerk");
      }

      const nameUpdated = await organizationRepository.updateNameByClerkOrgId(
        db,
        clerkOrgId,
        input.name,
      );

      if (!nameUpdated) {
        throw new InternalError("Failed to update organization name");
      }
    }

    const updated = await organizationRepository.updateById(
      db,
      organization.id,
      {
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.multipleLocationsEnabled !== undefined
          ? { multipleLocationsEnabled: input.multipleLocationsEnabled }
          : {}),
      },
    );

    if (!updated) {
      throw new InternalError("Failed to update organization");
    }

    await tenantCache.invalidate(clerkOrgId);

    return enrichOrganizationFromClerk(toOrganizationResponse(updated));
  },

  async uploadLogo(
    db: Db,
    clerkOrgId: string,
    userId: string,
    file: File,
  ): Promise<OrganizationResponse> {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    assertValidLogoFile(file);

    try {
      await clerkClient.organizations.updateOrganizationLogo(clerkOrgId, {
        file,
        uploaderUserId: userId,
      });
    } catch {
      throw new InternalError("Failed to upload organization logo");
    }

    await tenantCache.invalidate(clerkOrgId);

    return enrichOrganizationFromClerk(toOrganizationResponse(organization));
  },

  async deleteLogo(
    db: Db,
    clerkOrgId: string,
  ): Promise<OrganizationResponse> {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    try {
      await clerkClient.organizations.deleteOrganizationLogo(clerkOrgId);
    } catch {
      throw new InternalError("Failed to delete organization logo");
    }

    await tenantCache.invalidate(clerkOrgId);

    return enrichOrganizationFromClerk(toOrganizationResponse(organization));
  },
};
