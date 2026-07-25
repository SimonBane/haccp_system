import type { Context } from "hono";
import type { Db } from "../core/db/client.js";
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
