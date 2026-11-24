import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  locationResourceParamSchema,
  targetDuplicateInputSchema,
  targetInputSchema,
  targetListResponseSchema,
  targetResponseSchema,
} from "@haccp/shared";
import { registerAdminCrudRoutes } from "../../core/openapi/route-factory.js";
import {
  bearerSecurity,
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/responses.js";
import { getCurrentLocation, getDb } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { targetService } from "./target.service.js";

export const targetRoutes = new OpenAPIHono<AppEnv>();

registerAdminCrudRoutes({
  router: targetRoutes,
  tag: "Targets",
  schemas: {
    create: targetInputSchema,
    update: targetInputSchema,
    list: targetListResponseSchema,
    item: targetResponseSchema,
  },
  service: targetService,
});

const duplicateRoute = createRoute({
  method: "post",
  path: "/{id}/duplicate",
  tags: ["Targets"],
  security: bearerSecurity,
  request: {
    params: locationResourceParamSchema,
    body: {
      content: { "application/json": { schema: targetDuplicateInputSchema } },
    },
  },
  responses: {
    201: jsonResponse(targetResponseSchema, "Created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

targetRoutes.openapi(
  duplicateRoute,
  defineRouteHandler(duplicateRoute, async (c) => {
    const { id: locationId } = getCurrentLocation(c);
    const { id } = c.req.valid("param");
    const created = await targetService.duplicate(
      getDb(c),
      locationId,
      id,
      c.req.valid("json"),
    );
    return c.json(created, 201);
  }),
);
