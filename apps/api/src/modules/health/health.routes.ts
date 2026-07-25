import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { healthResponseSchema } from "@haccp/shared";
import { jsonResponse } from "../../core/openapi/responses.js";
import { getDb } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { healthService } from "./health.service.js";

export const healthRoutes = new OpenAPIHono<AppEnv>();

const healthRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Health"],
  responses: {
    200: jsonResponse(healthResponseSchema),
  },
});

healthRoutes.openapi(healthRoute, async (c) => {
  const payload = await healthService.getHealth(getDb(c));
  return c.json(payload, 200);
});
