import type { LocationResponse } from "@haccp/shared";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "./core/db/client.js";

export type AppEnv = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string | null;
    orgRole: string | null;
    db: Db;
    currentLocation: LocationResponse | undefined;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
