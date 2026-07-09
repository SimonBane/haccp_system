import { OpenAPIHono } from "@hono/zod-openapi";
import { healthResponseSchema } from "@haccp/shared";
import { db } from "../db/index.js";
import { healthService } from "../services/health.service.js";
import type { AppEnv } from "../types.js";

export const healthRoutes = new OpenAPIHono<AppEnv>();

healthRoutes.get("/", async (c) => {
  const payload = await healthService.getHealth(db);
  return c.json(healthResponseSchema.parse(payload), 200);
});
