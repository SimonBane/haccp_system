import type { EmployeeResponse, LocationResponse } from "@haccp/shared";
import { normalizeOrgRole } from "@haccp/shared";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import { toLocationResponse } from "../locations/location.mapper.js";
import type { Location } from "../../core/db/schema/locations.js";
import { toUserResponse } from "../users/user.mapper.js";

export function toEmployeeResponse(params: {
  membership: OrganizationMembership;
  user: User;
  locationIds: string[];
  locations: LocationResponse[];
}): EmployeeResponse {
  const { membership, user, locationIds, locations } = params;
  const userResponse = toUserResponse(user);

  return {
    id: membership.id,
    email: userResponse.email,
    firstName: userResponse.firstName,
    lastName: userResponse.lastName,
    role: normalizeOrgRole(membership.role),
    status: membership.status as EmployeeResponse["status"],
    locationIds,
    locations,
    invitedAt: membership.invitedAt?.toISOString() ?? null,
    user: userResponse,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}

export function mapLocations(
  allLocations: Location[],
  locationIds: string[],
): LocationResponse[] {
  const locationMap = new Map(
    allLocations.map((location) => [location.id, toLocationResponse(location)]),
  );

  return locationIds
    .map((id) => locationMap.get(id))
    .filter((location): location is LocationResponse => Boolean(location));
}

export function mapLocationResponses(
  allLocations: LocationResponse[],
  locationIds: string[],
): LocationResponse[] {
  const locationMap = new Map(
    allLocations.map((location) => [location.id, location]),
  );

  return locationIds
    .map((id) => locationMap.get(id))
    .filter((location): location is LocationResponse => Boolean(location));
}
