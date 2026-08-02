import {
  type OrganizationResponse,
  type UpdateOrganizationInput,
  type UpdateOrganizationNameInput,
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
import { tenantCache } from "../tenant/tenant-cache.js";
import { toOrganizationResponse } from "./organization.mapper.js";
import { organizationRepository } from "./organization.repository.js";

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
  async updateName(
    db: Db,
    clerkOrgId: string,
    organization: OrganizationResponse,
    input: UpdateOrganizationNameInput,
  ): Promise<OrganizationResponse> {
    if (input.name === organization.name) {
      return organization;
    }

    try {
      await clerkClient.organizations.updateOrganization(clerkOrgId, {
        name: input.name,
      });
    } catch {
      throw new InternalError("Failed to update organization name in Clerk");
    }

    const updated = await organizationRepository.updateNameByClerkOrgId(
      db,
      clerkOrgId,
      input.name,
    );

    if (!updated) {
      throw new NotFoundError("Organization not found");
    }

    await tenantCache.invalidate(clerkOrgId);

    return toOrganizationResponse(updated);
  },

  async updateSettings(
    db: Db,
    clerkOrgId: string,
    organization: OrganizationResponse,
    locationCount: number,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationResponse> {
    if (
      input.multipleLocationsEnabled === false &&
      organization.multipleLocationsEnabled &&
      locationCount > 1
    ) {
      throw new ConflictError(
        "Cannot disable multiple locations while more than one site exists",
      );
    }

    const updated = await organizationRepository.updateByClerkOrgId(
      db,
      clerkOrgId,
      {
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.multipleLocationsEnabled !== undefined
          ? { multipleLocationsEnabled: input.multipleLocationsEnabled }
          : {}),
      },
    );

    if (!updated) {
      throw new NotFoundError("Organization not found");
    }

    await tenantCache.invalidate(clerkOrgId);

    return toOrganizationResponse(updated);
  },

  async uploadLogo(
    db: Db,
    clerkOrgId: string,
    userId: string,
    file: File,
  ): Promise<OrganizationResponse> {
    assertValidLogoFile(file);

    let clerkOrg;
    try {
      clerkOrg = await clerkClient.organizations.updateOrganizationLogo(
        clerkOrgId,
        {
          file,
          uploaderUserId: userId,
        },
      );
    } catch {
      throw new InternalError("Failed to upload organization logo");
    }

    const updated = await organizationRepository.updateByClerkOrgId(
      db,
      clerkOrgId,
      {
        imageUrl: clerkOrg.imageUrl,
        hasImage: clerkOrg.hasImage,
      },
    );

    if (!updated) {
      throw new NotFoundError("Organization not found");
    }

    await tenantCache.invalidate(clerkOrgId);

    return toOrganizationResponse(updated);
  },

  async deleteLogo(
    db: Db,
    clerkOrgId: string,
  ): Promise<OrganizationResponse> {
    let clerkOrg;
    try {
      clerkOrg = await clerkClient.organizations.deleteOrganizationLogo(
        clerkOrgId,
      );
    } catch {
      throw new InternalError("Failed to delete organization logo");
    }

    const updated = await organizationRepository.updateByClerkOrgId(
      db,
      clerkOrgId,
      {
        imageUrl: clerkOrg.imageUrl,
        hasImage: clerkOrg.hasImage,
      },
    );

    if (!updated) {
      throw new NotFoundError("Organization not found");
    }

    await tenantCache.invalidate(clerkOrgId);

    return toOrganizationResponse(updated);
  },
};
