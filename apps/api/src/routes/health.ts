import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { apiErrorSchema, healthResponseSchema } from "@haccp/shared";
import { db } from "../db/index.js";
import { healthService } from "../services/health.service.js";
import type { AppEnv } from "../types.js";

export const healthRoutes = new OpenAPIHono<AppEnv>();

const healthRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Health"],
  summary: "Health check",
  description: "Returns API status and verifies database connectivity.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
      description: "API and database are healthy",
    },
    500: {
      content: {
        "application/json": {
          schema: apiErrorSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

healthRoutes.openapi(healthRoute, async (c) => {
  const payload = await healthService.getHealth(db);
  return c.json(healthResponseSchema.parse(payload), 200);
});
