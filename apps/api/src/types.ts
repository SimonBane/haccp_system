import type { OpenAPIHono } from "@hono/zod-openapi";

export type AppEnv = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string | null;
    orgRole: string | null;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
