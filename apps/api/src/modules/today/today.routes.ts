import { bearerSecurity } from "../../core/openapi/responses.js";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { todayDateQuerySchema, todayResponseSchema } from "@haccp/shared";
import {
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import {
  getDb,
  getCurrentLocation,
  getCurrentOrganization,
  requireOrgContext,
} from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { todayService } from "./today.service.js";

export const todayRoutes = new OpenAPIHono<AppEnv>();

const getTodayRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Today"],
  security: bearerSecurity,
  request: {
    query: todayDateQuerySchema,
  },
  responses: {
    200: jsonResponse(todayResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

todayRoutes.openapi(
  getTodayRoute,
  defineRouteHandler(getTodayRoute, async (c) => {
    const { date } = c.req.valid("query");
    const { id: locationId } = getCurrentLocation(c);
    const { user } = requireOrgContext(c);
    const result = await todayService.getToday(
      getDb(c),
      locationId,
      date,
      user.id,
      getCurrentOrganization(c).timezone,
    );
    return c.json(result, 200);
  }),
);
