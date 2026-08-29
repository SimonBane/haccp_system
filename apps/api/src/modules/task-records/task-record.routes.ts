import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  taskRecordInputSchema,
  taskRecordParamSchema,
  taskRecordResponseSchema,
} from "@haccp/shared";
import {
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { bearerSecurity } from "../../core/openapi/responses.js";
import {
  getCurrentLocation,
  getDb,
  requireOrgContext,
} from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { taskRecordService } from "./task-record.service.js";

export const taskRecordRoutes = new OpenAPIHono<AppEnv>();

const createRecordRoute = createRoute({
  method: "post",
  path: "/{occurrenceId}/record",
  tags: ["Task Records"],
  security: bearerSecurity,
  description:
    "Submit the first record for an occurrence. Any org member may record.",
  request: {
    params: taskRecordParamSchema,
    body: {
      content: { "application/json": { schema: taskRecordInputSchema } },
    },
  },
  responses: {
    201: jsonResponse(taskRecordResponseSchema, "Created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

const updateRecordRoute = createRoute({
  method: "put",
  path: "/{occurrenceId}/record",
  tags: ["Task Records"],
  security: bearerSecurity,
  description:
    "Edit the current value or reactivate a voided record. Any org member may record.",
  request: {
    params: taskRecordParamSchema,
    body: {
      content: { "application/json": { schema: taskRecordInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(taskRecordResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const voidRecordRoute = createRoute({
  method: "delete",
  path: "/{occurrenceId}/record",
  tags: ["Task Records"],
  security: bearerSecurity,
  description: "Undo the current record (soft void). Any org member may undo.",
  request: {
    params: taskRecordParamSchema,
  },
  responses: {
    200: jsonResponse(taskRecordResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

taskRecordRoutes.openapi(
  createRecordRoute,
  defineRouteHandler(createRecordRoute, async (c) => {
    const { occurrenceId } = c.req.valid("param");
    const { id: locationId } = getCurrentLocation(c);
    const { userDbId } = requireOrgContext(c);
    const input = c.req.valid("json");

    const result = await taskRecordService.create(
      getDb(c),
      { locationId, occurrenceId, actorUserId: userDbId },
      input,
    );

    return c.json(result, 201);
  }),
);

taskRecordRoutes.openapi(
  updateRecordRoute,
  defineRouteHandler(updateRecordRoute, async (c) => {
    const { occurrenceId } = c.req.valid("param");
    const { id: locationId } = getCurrentLocation(c);
    const { userDbId } = requireOrgContext(c);
    const input = c.req.valid("json");

    const result = await taskRecordService.update(
      getDb(c),
      { locationId, occurrenceId, actorUserId: userDbId },
      input,
    );

    return c.json(result, 200);
  }),
);

taskRecordRoutes.openapi(
  voidRecordRoute,
  defineRouteHandler(voidRecordRoute, async (c) => {
    const { occurrenceId } = c.req.valid("param");
    const { id: locationId } = getCurrentLocation(c);
    const { userDbId } = requireOrgContext(c);

    const result = await taskRecordService.remove(getDb(c), {
      locationId,
      occurrenceId,
      actorUserId: userDbId,
    });

    return c.json(result, 200);
  }),
);
