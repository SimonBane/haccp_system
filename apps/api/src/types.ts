import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "./core/db/client.js";

export type AppLocationContext = {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AppEnv = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string | null;
    orgRole: string | null;
    db: Db;
    currentLocation: AppLocationContext | undefined;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
