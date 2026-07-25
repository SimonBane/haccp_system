import type { LocationResponse } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { InternalError, NotFoundError } from "../../core/errors/app-errors.js";
import { toLocationResponse } from "./location.mapper.js";
import { locationRepository } from "./location.repository.js";

export const locationService = {
  async getOrCreateCurrentLocation(
    db: Db,
    orgId: string,
  ): Promise<LocationResponse> {
    const location = await locationRepository.upsertDefaultForOrg(db, orgId);

    if (!location) {
      throw new InternalError("Failed to resolve location");
    }

    return toLocationResponse(location);
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
