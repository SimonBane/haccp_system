import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "./core/db/client.js";

export type AppEnv = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string | null;
    orgRole: string | null;
    db: Db;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
