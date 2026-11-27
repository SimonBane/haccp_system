import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  recordsFilterOptionsResponseSchema,
  recordsJournalsResponseSchema,
  recordsListQuerySchema,
  recordsListResponseSchema,
  recordsReportQuerySchema,
  recordsReportResponseSchema,
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
    "Historical records for one location and organization-local date range, searchable by check or item name. Admin only.",
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

const reportRecordsRoute = createRoute({
  method: "get",
  path: "/report",
  tags: ["Records"],
  security: bearerSecurity,
  description:
    "Complete Records dataset for one location and organization-local date range, read from a single consistent snapshot for browser printing. Admin only.",
  request: {
    query: recordsReportQuerySchema,
  },
  responses: {
    200: jsonResponse(recordsReportResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

recordsRoutes.openapi(
  reportRecordsRoute,
  defineRouteHandler(reportRecordsRoute, async (c) => {
    const query = c.req.valid("query");
    const { id: locationId } = getCurrentLocation(c);
    const { organizationId } = requireOrgContext(c);

    const result = await recordsService.getRecordsReport(getDb(c), {
      locationId,
      organizationId,
      timeZone: getCurrentOrganization(c).timezone,
      query,
    });

    return c.json(result, 200);
  }),
);

const listJournalsRoute = createRoute({
  method: "get",
  path: "/journals",
  tags: ["Records"],
  security: bearerSecurity,
  description:
    "How many Records rows each check has for one location, date range and set of filters: the journals the print dialog offers. Admin only.",
  request: {
    query: recordsReportQuerySchema,
  },
  responses: {
    200: jsonResponse(recordsJournalsResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

recordsRoutes.openapi(
  listJournalsRoute,
  defineRouteHandler(listJournalsRoute, async (c) => {
    const query = c.req.valid("query");
    const { id: locationId } = getCurrentLocation(c);
    const { organizationId } = requireOrgContext(c);

    const result = await recordsService.listJournals(getDb(c), {
      locationId,
      organizationId,
      timeZone: getCurrentOrganization(c).timezone,
      query,
    });

    return c.json(result, 200);
  }),
);

const filterOptionsRoute = createRoute({
  method: "get",
  path: "/filters",
  tags: ["Records"],
  security: bearerSecurity,
  description:
    "The checks, items and people a Records filter can offer for one location, archived ones included. Admin only.",
  responses: {
    200: jsonResponse(recordsFilterOptionsResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

recordsRoutes.openapi(
  filterOptionsRoute,
  defineRouteHandler(filterOptionsRoute, async (c) => {
    const { id: locationId } = getCurrentLocation(c);
    const { organizationId } = requireOrgContext(c);

    const result = await recordsService.getFilterOptions(getDb(c), {
      locationId,
      organizationId,
    });

    return c.json(result, 200);
  }),
);
