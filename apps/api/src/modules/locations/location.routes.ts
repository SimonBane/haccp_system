// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  createLocationSchema,
  locationListResponseSchema,
  locationResponseSchema,
  updateLocationSchema,
  uuidParamSchema,
} from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { ForbiddenError } from "../../core/errors/app-errors.js";
import {
  getDb,
  getTenantContext,
  requireOrgContext,
} from "../../lib/context.js";
import { locationService } from "./location.service.js";
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

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Locations"],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(locationListResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  tags: ["Locations"],
  security: bearerSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: createLocationSchema,
        },
      },
    },
  },
  responses: {
    201: jsonResponse(locationResponseSchema, "Created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    409: errorResponse("Conflict"),
  },
});

const updateRouteDef = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Locations"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateLocationSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(locationResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

const deleteRouteDef = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Locations"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
  },
  responses: {
    204: { description: "Deleted" },
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

locationRoutes.openapi(getCurrentRoute, async (c) => {
  const tenant = getTenantContext(c);
  return c.json(tenant.currentLocation, 200);
});

locationRoutes.openapi(listRoute, async (c) => {
  const { organizationId } = requireOrgContext(c);
  const result = await locationService.listByOrganization(
    getDb(c),
    organizationId,
  );
  return c.json(result, 200);
});

locationRoutes.openapi(createRouteDef, async (c) => {
  if (c.get("orgRole") !== "org:admin") {
    throw new ForbiddenError("Admin access required");
  }

  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const input = c.req.valid("json");
  const created = await locationService.create(
    getDb(c),
    clerkOrgId,
    organizationId,
    input,
  );
  return c.json(created, 201);
});

locationRoutes.openapi(updateRouteDef, async (c) => {
  if (c.get("orgRole") !== "org:admin") {
    throw new ForbiddenError("Admin access required");
  }

  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const updated = await locationService.update(
    getDb(c),
    clerkOrgId,
    organizationId,
    id,
    input,
  );
  return c.json(updated, 200);
});

locationRoutes.openapi(deleteRouteDef, async (c) => {
  if (c.get("orgRole") !== "org:admin") {
    throw new ForbiddenError("Admin access required");
  }

  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  await locationService.delete(getDb(c), clerkOrgId, organizationId, id);
  return c.body(null, 204);
});
