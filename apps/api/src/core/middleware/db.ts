import { createMiddleware } from "hono/factory";
import { db } from "../db/client.js";
import type { AppEnv } from "../../types.js";

export const dbMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", db);
  await next();
});
