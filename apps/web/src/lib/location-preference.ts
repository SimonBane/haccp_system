import { pickDefaultLocation, type LocationResponse } from "@haccp/shared";

export const LOCATION_COOKIE = "haccp_location_id";
export const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function resolveLocationId(
  locations: LocationResponse[],
  preferredLocationId?: string | null,
): string {
  if (
    preferredLocationId &&
    locations.some((location) => location.id === preferredLocationId)
  ) {
    return preferredLocationId;
  }

  return pickDefaultLocation(locations).id;
}

export function buildLocationCookie(locationId: string): string {
  return `${LOCATION_COOKIE}=${encodeURIComponent(locationId)}; path=/; max-age=${LOCATION_COOKIE_MAX_AGE}; samesite=lax`;
}
