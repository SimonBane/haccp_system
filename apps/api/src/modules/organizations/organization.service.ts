import type { OrganizationResponse, UpdateOrganizationInput } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { locationRepository } from "../locations/location.repository.js";
import { toOrganizationResponse } from "./organization.mapper.js";
import { organizationRepository } from "./organization.repository.js";
import { tenantCache } from "../tenant/tenant-cache.js";

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

    return toOrganizationResponse(updated);
  },
};
