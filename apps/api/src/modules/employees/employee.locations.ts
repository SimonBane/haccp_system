import type { LocationResponse, OrgRole } from "@haccp/shared";
import { pickDefaultLocation, requiresLocationAssignments } from "@haccp/shared";

// The single point where the admins-see-everything invariant is enforced on writes:
// admins get no assignment rows, employees always end up with at least one.
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
