import type { LocationResponse, OrgRole } from "@haccp/shared";
import { pickDefaultLocation, requiresLocationAssignments } from "@haccp/shared";

export function resolveLocationAssignments(
  role: OrgRole,
  requested: string[] | undefined,
  tenantLocations: LocationResponse[],
): string[] {
  if (!requiresLocationAssignments(role)) {
    return [];
  }

  if (requested && requested.length > 0) {
    return requested;
  }

  return [pickDefaultLocation(tenantLocations).id];
}

export function sameLocationIds(current: string[], next: string[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  const currentIds = new Set(current);
  return next.every((locationId) => currentIds.has(locationId));
}
