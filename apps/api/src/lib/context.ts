import type { Context } from "hono";
import type { Db } from "../core/db/client.js";
import { InternalError } from "../core/errors/app-errors.js";
import type {
  AppEnv,
  AppLocationContext,
  AppOrganizationContext,
  AppTenantContext,
} from "../types.js";

export function requireOrgContext(c: Context<AppEnv>) {
  const clerkOrgId = c.get("orgId");
  const organizationId = c.get("organizationId");
  const userDbId = c.get("userDbId");

  if (!clerkOrgId || !organizationId) {
    throw new InternalError("Organization context is not resolved");
  }

  if (!userDbId) {
    throw new InternalError("User context is not resolved");
  }

  return {
    clerkOrgId,
    organizationId,
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
  const organization = c.get("currentOrganization");

  if (!organization) {
    throw new InternalError("Current organization not resolved for request");
  }

  return organization;
}

export function getTenantContext(c: Context<AppEnv>): AppTenantContext {
  const organization = c.get("currentOrganization");
  const locations = c.get("tenantLocations");
  const currentLocation = c.get("currentLocation");

  if (!organization || !locations || !currentLocation) {
    throw new InternalError("Tenant context is not resolved for request");
  }

  return {
    organization,
    locations,
    currentLocation,
  };
}
