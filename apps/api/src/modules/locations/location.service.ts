import type {
  CreateLocationInput,
  LocationListResponse,
  LocationResponse,
  UpdateLocationInput,
} from "@haccp/shared";
import { API_ERROR_CODE } from "@haccp/shared";
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

export const locationService = {
  listFromTenant(locations: LocationResponse[]): LocationListResponse {
    return { items: locations };
  },

  async create(
    db: Db,
    clerkOrgId: string,
    organizationId: string,
    multipleLocationsEnabled: boolean,
    input: CreateLocationInput,
  ): Promise<LocationResponse> {
    if (!multipleLocationsEnabled) {
      throw new ConflictError("Multiple locations are not enabled", {
        code: API_ERROR_CODE.MULTIPLE_LOCATIONS_DISABLED,
      });
    }

    try {
      if (input.isDefault) {
        await locationRepository.clearDefaultForOrganization(
          db,
          organizationId,
        );
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
          new ConflictError("A location with this name already exists", {
            code: API_ERROR_CODE.LOCATION_NAME_EXISTS,
          }),
      });
    }
  },

  async update(
    db: Db,
    clerkOrgId: string,
    organizationId: string,
    locationId: string,
    input: UpdateLocationInput,
    currentLocation?: LocationResponse,
  ): Promise<LocationResponse> {
    if (input.isDefault && currentLocation && !currentLocation.isDefault) {
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
          new ConflictError("A location with this name already exists", {
            code: API_ERROR_CODE.LOCATION_NAME_EXISTS,
          }),
      });
    }
  },

  async delete(
    db: Db,
    clerkOrgId: string,
    organizationId: string,
    locationId: string,
    tenantLocations: LocationResponse[],
  ): Promise<void> {
    const location = tenantLocations.find((entry) => entry.id === locationId);

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    if (location.isDefault) {
      throw new ConflictError("Cannot delete the default location", {
        code: API_ERROR_CODE.DEFAULT_LOCATION_DELETE_FORBIDDEN,
      });
    }

    if (tenantLocations.length <= 1) {
      throw new ConflictError("Cannot delete the last location", {
        code: API_ERROR_CODE.LAST_LOCATION_DELETE_FORBIDDEN,
      });
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
            { code: API_ERROR_CODE.LOCATION_HAS_DEPENDENCIES },
          ),
      });
    }
  },
};
