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
import {
  getDb,
  getTenant,
  requireOrgContext,
} from "../../lib/context.js";
import { locationService } from "./location.service.js";
import type { AppEnv } from "../../types.js";

const bearerSecurity = [{ Bearer: [] }];

export const locationRoutes = new OpenAPIHono<AppEnv>();

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

locationRoutes.openapi(listRoute, async (c) => {
  const tenant = getTenant(c);
  const result = locationService.listFromTenant(tenant.locations);
  return c.json(result, 200);
});

locationRoutes.openapi(createRouteDef, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const organization = getTenant(c).organization;
  const input = c.req.valid("json");
  const created = await locationService.create(
    getDb(c),
    clerkOrgId,
    organizationId,
    organization.multipleLocationsEnabled,
    input,
  );
  return c.json(created, 201);
});

locationRoutes.openapi(updateRouteDef, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const currentLocation = getTenant(c).locations.find(
    (location) => location.id === id,
  );
  const updated = await locationService.update(
    getDb(c),
    clerkOrgId,
    organizationId,
    id,
    input,
    currentLocation,
  );
  return c.json(updated, 200);
});

locationRoutes.openapi(deleteRouteDef, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  await locationService.delete(
    getDb(c),
    clerkOrgId,
    organizationId,
    id,
    getTenant(c).locations,
  );
  return c.body(null, 204);
});
