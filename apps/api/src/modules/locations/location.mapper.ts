import type { Location } from "../../core/db/schema/locations.js";
import type { LocationResponse } from "@haccp/shared";

export function toLocationResponse(location: Location): LocationResponse {
  return {
    id: location.id,
    organizationId: location.organizationId,
    name: location.name,
    isDefault: location.isDefault,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}
