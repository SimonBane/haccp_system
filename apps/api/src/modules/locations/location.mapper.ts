import type { LocationResponse } from "@haccp/shared";
import { locations } from "../../core/db/schema/locations.js";

type LocationRow = typeof locations.$inferSelect;

export function toLocationResponse(location: LocationRow): LocationResponse {
  return {
    id: location.id,
    orgId: location.orgId,
    name: location.name,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}
