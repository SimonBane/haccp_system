import type { LocationResponse } from "@haccp/shared";
import type { Context } from "hono";
import type { Db } from "../core/db/client.js";
import {
  InternalError,
  NotFoundError,
} from "../core/errors/app-errors.js";
import type { ResolvedTenant } from "../modules/tenant/tenant.service.js";
import type {
  AppEnv,
  AppLocationContext,
  AppOrganizationContext,
  AppTenantContext,
} from "../types.js";

function filterAccessibleLocations(
  tenant: ResolvedTenant,
  assignedLocationIds: string[] | null | undefined,
): LocationResponse[] {
  if (!assignedLocationIds) {
    return tenant.locations;
  }

  return tenant.locations.filter((location) =>
    assignedLocationIds.includes(location.id),
  );
}

export function getTenant(c: Context<AppEnv>): ResolvedTenant {
  const tenant = c.get("tenant");

  if (!tenant) {
    throw new InternalError("Tenant context is not resolved");
  }

  return tenant;
}

export function requireOrgContext(c: Context<AppEnv>) {
  const clerkOrgId = c.get("orgId");
  const tenant = getTenant(c);
  const userDbId = c.get("userDbId");

  if (!clerkOrgId) {
    throw new InternalError("Organization context is not resolved");
  }

  if (!userDbId) {
    throw new NotFoundError("User not found");
  }

  return {
    clerkOrgId,
    organizationId: tenant.organizationId,
    userId: c.get("userId")!,
    userDbId,
  };
}

export function getDb(c: Context<AppEnv>): Db {
  return c.get("db");
}

export function getCurrentLocation(c: Context<AppEnv>): AppLocationContext {
  const location = c.get("currentLocation");

  if (!location) {
    throw new InternalError("Current location not resolved for request");
  }

  return location;
}

export function getCurrentOrganization(
  c: Context<AppEnv>,
): AppOrganizationContext {
  return getTenant(c).organization;
}

export function getTenantContext(c: Context<AppEnv>): AppTenantContext {
  const tenant = getTenant(c);

  return {
    organization: tenant.organization,
    locations: filterAccessibleLocations(tenant, c.get("assignedLocationIds")),
  };
}
