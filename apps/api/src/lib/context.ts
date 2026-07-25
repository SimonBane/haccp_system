import type { LocationResponse } from "@haccp/shared";
import type { Context } from "hono";
import type { Db } from "../core/db/client.js";
import { InternalError } from "../core/errors/app-errors.js";
import type { AppEnv } from "../types.js";

export function requireOrgContext(c: Context<AppEnv>) {
  return {
    orgId: c.get("orgId")!,
    userId: c.get("userId")!,
  };
}

export function getDb(c: Context<AppEnv>): Db {
  return c.get("db");
}

export function getCurrentLocation(c: Context<AppEnv>): LocationResponse {
  const location = c.get("currentLocation");

  if (!location) {
    throw new InternalError("Current location not resolved for request");
  }

  return location;
}
