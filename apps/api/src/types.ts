import type { OpenAPIHono } from "@hono/zod-openapi";

export type AppEnv = {
  Variables: {
    requestId: string;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
