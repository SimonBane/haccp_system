import type { LocationResponse, UpdateEmployeeInput } from "@haccp/shared";
import { normalizeEmail, normalizeOrgRole, normalizeName } from "@haccp/shared";
import {
  resolveLocationAssignments,
  sameLocationIds,
} from "./employee.locations.js";
import type { EmployeeDetail } from "./employee.mapper.js";

export type EmployeeChanges = {
  email?: string;
  firstName?: string;
  lastName?: string;
  locationIds?: string[];
};

export function diffEmployeeChanges(
  detail: EmployeeDetail,
  input: UpdateEmployeeInput,
  tenantLocations: LocationResponse[],
): EmployeeChanges {
  const changes: EmployeeChanges = {};

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (email !== normalizeEmail(detail.user.email)) {
      changes.email = email;
    }
  }

  if (input.firstName !== undefined) {
    const firstName = normalizeName(input.firstName);
    if (firstName !== normalizeName(detail.user.firstName)) {
      changes.firstName = firstName;
    }
  }

  if (input.lastName !== undefined) {
    const lastName = normalizeName(input.lastName);
    if (lastName !== normalizeName(detail.user.lastName)) {
      changes.lastName = lastName;
    }
  }

  const targetLocationIds = resolveLocationAssignments(
    normalizeOrgRole(detail.membership.role),
    input.locationIds ?? detail.locationIds,
    tenantLocations,
  );

  if (!sameLocationIds(detail.locationIds, targetLocationIds)) {
    changes.locationIds = targetLocationIds;
  }

  return changes;
}

export function hasProfileChanges(changes: EmployeeChanges): boolean {
  return (
    changes.email !== undefined ||
    changes.firstName !== undefined ||
    changes.lastName !== undefined
  );
}

export function isEmptyChangeSet(changes: EmployeeChanges): boolean {
  return Object.keys(changes).length === 0;
}
