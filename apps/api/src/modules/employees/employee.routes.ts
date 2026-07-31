// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  createEmployeeSchema,
  employeeListResponseSchema,
  employeeResponseSchema,
  updateEmployeeLocationsSchema,
  updateEmployeeRoleSchema,
  updateEmployeeSchema,
  uuidParamSchema,
} from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { getDb, getTenant, requireOrgContext } from "../../lib/context.js";
import { employeeService } from "./employee.service.js";
import type { AppEnv } from "../../types.js";

const bearerSecurity = [{ Bearer: [] }];

export const employeeRoutes = new OpenAPIHono<AppEnv>();

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Employees"],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(employeeListResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: createEmployeeSchema,
        },
      },
    },
  },
  responses: {
    201: jsonResponse(employeeResponseSchema, "Created"),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    409: errorResponse("Conflict"),
  },
});

const updateRouteDef = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateEmployeeSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(employeeResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

const inviteRoute = createRoute({
  method: "post",
  path: "/{id}/invite",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
  },
  responses: {
    200: jsonResponse(employeeResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const revokeInvitationRoute = createRoute({
  method: "delete",
  path: "/{id}/invitation",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
  },
  responses: {
    200: jsonResponse(employeeResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const updateRoleRoute = createRoute({
  method: "patch",
  path: "/{id}/role",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateEmployeeRoleSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(employeeResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const updateLocationsRoute = createRoute({
  method: "patch",
  path: "/{id}/locations",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateEmployeeLocationsSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(employeeResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

const deleteRouteDef = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
  },
  responses: {
    204: { description: "Deleted" },
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

employeeRoutes.openapi(listRoute, async (c) => {
  const { organizationId } = requireOrgContext(c);
  const result = await employeeService.list(getDb(c), organizationId);
  return c.json(result, 200);
});

employeeRoutes.openapi(createRouteDef, async (c) => {
  const { clerkOrgId, organizationId, userId } = requireOrgContext(c);
  const input = c.req.valid("json");
  const created = await employeeService.create(
    getDb(c),
    organizationId,
    clerkOrgId,
    userId,
    input,
    getTenant(c).locations,
  );
  return c.json(created, 201);
});

employeeRoutes.openapi(updateRouteDef, async (c) => {
  const { organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const updated = await employeeService.update(
    getDb(c),
    organizationId,
    id,
    input,
    getTenant(c).locations,
  );
  return c.json(updated, 200);
});

employeeRoutes.openapi(inviteRoute, async (c) => {
  const { clerkOrgId, organizationId, userId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const updated = await employeeService.invite(
    getDb(c),
    organizationId,
    clerkOrgId,
    userId,
    id,
    getTenant(c).locations,
  );
  return c.json(updated, 200);
});

employeeRoutes.openapi(revokeInvitationRoute, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const updated = await employeeService.revokeInvitation(
    getDb(c),
    organizationId,
    clerkOrgId,
    id,
    getTenant(c).locations,
  );
  return c.json(updated, 200);
});

employeeRoutes.openapi(updateRoleRoute, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const updated = await employeeService.updateRole(
    getDb(c),
    organizationId,
    clerkOrgId,
    id,
    input,
    getTenant(c).locations,
  );
  return c.json(updated, 200);
});

employeeRoutes.openapi(updateLocationsRoute, async (c) => {
  const { organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const updated = await employeeService.updateLocations(
    getDb(c),
    organizationId,
    id,
    input,
    getTenant(c).locations,
  );
  return c.json(updated, 200);
});

employeeRoutes.openapi(deleteRouteDef, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  await employeeService.remove(getDb(c), organizationId, clerkOrgId, id);
  return c.body(null, 204);
});
