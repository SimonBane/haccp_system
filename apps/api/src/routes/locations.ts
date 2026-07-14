import { locationResponseSchema } from "@haccp/shared";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "../db/index.js";
import { locationService } from "../services/location.service.js";
import type { AppEnv } from "../types.js";

export const locationRoutes = new OpenAPIHono<AppEnv>();

locationRoutes.get("/current", async (c) => {
  const orgId = c.get("orgId")!;
  const location = await locationService.getOrCreateCurrentLocation(db, orgId);

  return c.json(locationResponseSchema.parse(location), 200);
});
