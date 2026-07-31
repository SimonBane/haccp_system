import type { LocationResponse } from "./schemas/location.js";

export function pickDefaultLocation(
  locations: LocationResponse[],
): LocationResponse {
  if (locations.length === 0) {
    throw new Error("No locations available");
  }

  return locations.find((location) => location.isDefault) ?? locations[0]!;
}
