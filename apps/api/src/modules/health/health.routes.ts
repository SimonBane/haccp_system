import { OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { healthService } from "./health.service.js";

export const healthRoutes = new OpenAPIHono<AppEnv>();

healthRoutes.get("/", async (c) => {
  const payload = await healthService.getHealth(getDb(c));
  return c.json(payload, 200);
});
