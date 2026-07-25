import type { LocationResponse } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { InternalError, NotFoundError } from "../../core/errors/app-errors.js";
import { locationCache } from "./location-cache.js";
import { toLocationResponse } from "./location.mapper.js";
import { locationRepository } from "./location.repository.js";

export const locationService = {
  async getCurrentLocation(
    db: Db,
    orgId: string,
  ): Promise<LocationResponse> {
    const cached = locationCache.get(orgId);

    if (cached) {
      return cached;
    }

    const existing = await locationRepository.findDefaultByOrg(db, orgId);

    if (existing) {
      const location = toLocationResponse(existing);
      locationCache.set(orgId, location);
      return location;
    }

    return locationService.ensureDefaultLocation(db, orgId);
  },

  async ensureDefaultLocation(
    db: Db,
    orgId: string,
  ): Promise<LocationResponse> {
    const location = await locationRepository.upsertDefaultForOrg(db, orgId);

    if (!location) {
      throw new InternalError("Failed to resolve location");
    }

    const response = toLocationResponse(location);
    locationCache.set(orgId, response);
    return response;
  },

  invalidateCachedLocation(orgId: string): void {
    locationCache.invalidate(orgId);
  },

  async assertLocationBelongsToOrg(
    db: Db,
    orgId: string,
    locationId: string,
  ): Promise<void> {
    const location = await locationRepository.findByIdAndOrg(
      db,
      orgId,
      locationId,
    );

    if (!location) {
      throw new NotFoundError("Location not found");
    }
  },
};
