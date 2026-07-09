import { Hono } from "hono";
import { healthResponseSchema } from "@haccp/shared";
import { db } from "../db/index.js";
import { healthService } from "../services/health.service.js";
import type { AppEnv } from "../types.js";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", async (c) => {
  const payload = await healthService.getHealth(db);
  return c.json(healthResponseSchema.parse(payload));
});
