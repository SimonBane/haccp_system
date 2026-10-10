import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  targetTypeIdParamSchema,
  targetTypeInputSchema,
  targetTypeListResponseSchema,
  targetTypeResponseSchema,
} from "@haccp/shared";
import {
  bearerSecurity,
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/responses.js";
import { getDb, requireOrgContext } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { targetTypeService } from "./target-type.service.js";

export const targetTypeRoutes = new OpenAPIHono<AppEnv>();

const TAG = "Target Types";

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: [TAG],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(targetTypeListResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  tags: [TAG],
  security: bearerSecurity,
  request: {
    body: {
      content: { "application/json": { schema: targetTypeInputSchema } },
    },
  },
  responses: {
    201: jsonResponse(targetTypeResponseSchema, "Created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    409: errorResponse("Conflict"),
  },
});

const updateRouteDef = createRoute({
  method: "patch",
  path: "/{targetTypeId}",
  tags: [TAG],
  security: bearerSecurity,
  request: {
    params: targetTypeIdParamSchema,
    body: {
      content: { "application/json": { schema: targetTypeInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(targetTypeResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

const deleteRouteDef = createRoute({
  method: "delete",
  path: "/{targetTypeId}",
  tags: [TAG],
  security: bearerSecurity,
  description: "Archives the type; refused while active targets use it.",
  request: { params: targetTypeIdParamSchema },
  responses: {
    204: { description: "Archived" },
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

targetTypeRoutes.openapi(
  listRoute,
  defineRouteHandler(listRoute, async (c) => {
    const { organizationId } = requireOrgContext(c);
    return c.json(await targetTypeService.list(getDb(c), organizationId), 200);
  }),
);

targetTypeRoutes.openapi(
  createRouteDef,
  defineRouteHandler(createRouteDef, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const created = await targetTypeService.create(
      getDb(c),
      organizationId,
      c.req.valid("json"),
    );
    return c.json(created, 201);
  }),
);

targetTypeRoutes.openapi(
  updateRouteDef,
  defineRouteHandler(updateRouteDef, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const { targetTypeId } = c.req.valid("param");
    const updated = await targetTypeService.update(
      getDb(c),
      organizationId,
      targetTypeId,
      c.req.valid("json"),
    );
    return c.json(updated, 200);
  }),
);

targetTypeRoutes.openapi(
  deleteRouteDef,
  defineRouteHandler(deleteRouteDef, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const { targetTypeId } = c.req.valid("param");
    await targetTypeService.delete(getDb(c), organizationId, targetTypeId);
    return c.body(null, 204);
  }),
);
