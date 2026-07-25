// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { meResponseSchema } from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import type { AppEnv } from "../../types.js";

const bearerSecurity = [{ Bearer: [] }];

export const meRoutes = new OpenAPIHono<AppEnv>();

const meRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Me"],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(meResponseSchema),
    401: errorResponse("Unauthorized"),
  },
});

meRoutes.openapi(meRoute, (c) => {
  return c.json(
    {
      userId: c.get("userId"),
      orgId: c.get("orgId"),
      orgRole: c.get("orgRole"),
    },
    200,
  );
});
