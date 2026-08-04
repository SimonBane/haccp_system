import {
  normalizeEmail,
  normalizeOrgRole,
  type EmployeeResponse,
} from "@haccp/shared";

export type EmployeeInviteMetadataValues = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export function displayName(employee: EmployeeResponse): string {
  const parts = [employee.firstName, employee.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : employee.email;
}

export function initials(employee: EmployeeResponse): string {
  const name = displayName(employee);
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function statusVariant(
  status: EmployeeResponse["status"],
): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "invited":
      return "secondary";
    case "draft":
      return "outline";
    default:
      return "outline";
  }
}

function normalizeName(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function hasInviteMetadataChanges(
  employee: EmployeeResponse,
  values: EmployeeInviteMetadataValues,
): boolean {
  if (normalizeEmail(values.email) !== normalizeEmail(employee.email)) {
    return true;
  }

  if (normalizeName(values.firstName) !== normalizeName(employee.firstName)) {
    return true;
  }

  if (normalizeName(values.lastName) !== normalizeName(employee.lastName)) {
    return true;
  }

  if (normalizeOrgRole(values.role) !== normalizeOrgRole(employee.role)) {
    return true;
  }

  return false;
}

export function resolveEmployeeLocationIds(
  locationIds: string[],
  options: {
    multipleLocationsEnabled: boolean;
    defaultLocationId: string;
  },
): string[] {
  if (options.multipleLocationsEnabled) {
    return locationIds;
  }

  return locationIds.length > 0 ? locationIds : [options.defaultLocationId];
}
