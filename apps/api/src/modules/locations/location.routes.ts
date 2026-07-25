// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { locationResponseSchema } from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { getCurrentLocation } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";

const bearerSecurity = [{ Bearer: [] }];

export const locationRoutes = new OpenAPIHono<AppEnv>();

const getCurrentRoute = createRoute({
  method: "get",
  path: "/current",
  tags: ["Locations"],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(locationResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

locationRoutes.openapi(getCurrentRoute, async (c) => {
  return c.json(getCurrentLocation(c), 200);
});
