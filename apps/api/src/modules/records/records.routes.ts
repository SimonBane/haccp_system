import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  recordsListQuerySchema,
  recordsListResponseSchema,
} from "@haccp/shared";
import {
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { bearerSecurity } from "../../core/openapi/responses.js";
import {
  getCurrentLocation,
  getCurrentOrganization,
  getDb,
  requireOrgContext,
} from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { recordsService } from "./records.service.js";

export const recordsRoutes = new OpenAPIHono<AppEnv>();

const listRecordsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Records"],
  security: bearerSecurity,
  description:
    "Historical records for one location and organization-local date range. Admin only.",
  request: {
    query: recordsListQuerySchema,
  },
  responses: {
    200: jsonResponse(recordsListResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

recordsRoutes.openapi(
  listRecordsRoute,
  defineRouteHandler(listRecordsRoute, async (c) => {
    const query = c.req.valid("query");
    const { id: locationId } = getCurrentLocation(c);
    const { organizationId } = requireOrgContext(c);

    const result = await recordsService.listRecords(getDb(c), {
      locationId,
      organizationId,
      timeZone: getCurrentOrganization(c).timezone,
      query,
    });

    return c.json(result, 200);
  }),
);
