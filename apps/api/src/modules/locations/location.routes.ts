import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { locationResponseSchema } from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { getDb, requireOrgContext } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { locationService } from "./location.service.js";

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
  const { orgId } = requireOrgContext(c);
  const location = await locationService.getOrCreateCurrentLocation(
    getDb(c),
    orgId,
  );
  return c.json(location, 200);
});
