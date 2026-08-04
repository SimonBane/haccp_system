import type { OrgRole, UpdateEmployeeInput } from "@haccp/shared";
import { normalizeEmail, normalizeOrgRole } from "@haccp/shared";
import type { EmployeeDetail } from "./employee.mapper.js";

export type EmployeeChanges = {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: OrgRole;
  locationIds?: string[];
};

export function normalizeName(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function sameLocationIds(current: string[], next: string[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  const currentIds = new Set(current);
  return next.every((locationId) => currentIds.has(locationId));
}

export function diffEmployeeChanges(
  detail: EmployeeDetail,
  input: UpdateEmployeeInput,
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

  if (input.role !== undefined) {
    const role = normalizeOrgRole(input.role);
    if (role !== normalizeOrgRole(detail.membership.role)) {
      changes.role = role;
    }
  }

  if (
    input.locationIds !== undefined &&
    !sameLocationIds(detail.locationIds, input.locationIds)
  ) {
    changes.locationIds = input.locationIds;
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

export function hasInviteMetadataChanges(changes: EmployeeChanges): boolean {
  return hasProfileChanges(changes) || changes.role !== undefined;
}

export function isEmptyChangeSet(changes: EmployeeChanges): boolean {
  return Object.keys(changes).length === 0;
}
