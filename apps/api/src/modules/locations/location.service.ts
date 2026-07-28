import type {
  CreateLocationInput,
  LocationListResponse,
  LocationResponse,
  UpdateLocationInput,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { tenantCache } from "../tenant/tenant-cache.js";
import { toLocationResponse } from "./location.mapper.js";
import { locationRepository } from "./location.repository.js";
import { organizationRepository } from "../organizations/organization.repository.js";

export const locationService = {
  async listByOrganization(
    db: Db,
    organizationId: string,
  ): Promise<LocationListResponse> {
    const rows = await locationRepository.findByOrganizationId(
      db,
      organizationId,
    );

    return {
      items: rows.map(toLocationResponse),
    };
  },

  async create(
    db: Db,
    clerkOrgId: string,
    organizationId: string,
    input: CreateLocationInput,
  ): Promise<LocationResponse> {
    const organization = await organizationRepository.findById(
      db,
      organizationId,
    );

    if (!organization?.multipleLocationsEnabled) {
      throw new ConflictError("Multiple locations are not enabled");
    }

    try {
      if (input.isDefault) {
        await locationRepository.clearDefaultForOrganization(db, organizationId);
      }

      const created = await locationRepository.insert(db, {
        organizationId,
        name: input.name,
        isDefault: input.isDefault ?? false,
      });

      if (!created) {
        throw new InternalError("Failed to create location");
      }

      await tenantCache.invalidate(clerkOrgId);
      return toLocationResponse(created);
    } catch (error) {
      mapDbMutationError(error, {
        unique: () =>
          new ConflictError("A location with this name already exists"),
        foreignKey: () => new NotFoundError("Organization not found"),
      });
    }
  },

  async update(
    db: Db,
    clerkOrgId: string,
    organizationId: string,
    locationId: string,
    input: UpdateLocationInput,
  ): Promise<LocationResponse> {
    if (input.isDefault) {
      await locationRepository.clearDefaultForOrganization(db, organizationId);
    }

    try {
      const updated = await locationRepository.updateByIdAndOrganization(
        db,
        organizationId,
        locationId,
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isDefault !== undefined
            ? { isDefault: input.isDefault }
            : {}),
        },
      );

      if (!updated) {
        throw new NotFoundError("Location not found");
      }

      await tenantCache.invalidate(clerkOrgId);
      return toLocationResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapDbMutationError(error, {
        unique: () =>
          new ConflictError("A location with this name already exists"),
      });
    }
  },

  async delete(
    db: Db,
    clerkOrgId: string,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    const location = await locationRepository.findByIdAndOrganization(
      db,
      organizationId,
      locationId,
    );

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    if (location.isDefault) {
      throw new ConflictError("Cannot delete the default location");
    }

    const locationCount = await locationRepository.countByOrganizationId(
      db,
      organizationId,
    );

    if (locationCount <= 1) {
      throw new ConflictError("Cannot delete the last location");
    }

    try {
      const deleted = await locationRepository.deleteByIdAndOrganization(
        db,
        organizationId,
        locationId,
      );

      if (!deleted) {
        throw new NotFoundError("Location not found");
      }

      await tenantCache.invalidate(clerkOrgId);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      mapDbMutationError(error, {
        foreignKey: () =>
          new ConflictError(
            "Cannot delete location while it has equipment or task data",
          ),
      });
    }
  },

  async assertLocationBelongsToOrganization(
    db: Db,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    const location = await locationRepository.findByIdAndOrganization(
      db,
      organizationId,
      locationId,
    );

    if (!location) {
      throw new NotFoundError("Location not found");
    }
  },
};
