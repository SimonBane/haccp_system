import type { Hono } from "hono";

export type AppEnv = {
  Variables: {
    requestId: string;
  };
};

export type AppHono = Hono<AppEnv>;
