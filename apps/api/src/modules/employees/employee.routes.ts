import { bearerSecurity } from "../../core/openapi/responses.js";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  createEmployeeSchema,
  employeeListResponseSchema,
  employeeResponseSchema,
  updateEmployeeLocationsSchema,
  updateEmployeeProfileSchema,
  updateEmployeeRoleSchema,
  uuidParamSchema,
} from "@haccp/shared";
import {
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { getDb, getTenant, requireOrgContext } from "../../lib/context.js";
import { employeeService } from "./employee.service.js";
import type { AppEnv } from "../../types.js";

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

const updateRoleRouteDef = createRoute({
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

const updateLocationsRouteDef = createRoute({
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

const updateProfileRouteDef = createRoute({
  method: "patch",
  path: "/{id}/profile",
  tags: ["Employees"],
  security: bearerSecurity,
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateEmployeeProfileSchema,
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

employeeRoutes.openapi(
  listRoute,
  defineRouteHandler(listRoute, async (c) => {
    const { organizationId } = requireOrgContext(c);
    const result = await employeeService.list(
      getDb(c),
      organizationId,
      getTenant(c).locations,
    );
    return c.json(result, 200);
  }),
);

employeeRoutes.openapi(
  createRouteDef,
  defineRouteHandler(createRouteDef, async (c) => {
    const { clerkOrgId, organizationId, userId } = requireOrgContext(c);
    const tenant = getTenant(c);
    const input = c.req.valid("json");
    const created = await employeeService.create(
      getDb(c),
      organizationId,
      clerkOrgId,
      userId,
      tenant.organization.locale,
      input,
      tenant.locations,
    );
    return c.json(created, 201);
  }),
);

employeeRoutes.openapi(
  updateRoleRouteDef,
  defineRouteHandler(updateRoleRouteDef, async (c) => {
    const { clerkOrgId, organizationId, userDbId } = requireOrgContext(c);
    const tenant = getTenant(c);
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const updated = await employeeService.updateRole(
      getDb(c),
      organizationId,
      clerkOrgId,
      userDbId,
      id,
      input,
      tenant.locations,
    );
    return c.json(updated, 200);
  }),
);

employeeRoutes.openapi(
  updateLocationsRouteDef,
  defineRouteHandler(updateLocationsRouteDef, async (c) => {
    const { clerkOrgId, organizationId } = requireOrgContext(c);
    const tenant = getTenant(c);
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const updated = await employeeService.updateLocations(
      getDb(c),
      organizationId,
      clerkOrgId,
      id,
      input,
      tenant.locations,
    );
    return c.json(updated, 200);
  }),
);

employeeRoutes.openapi(
  updateProfileRouteDef,
  defineRouteHandler(updateProfileRouteDef, async (c) => {
    const { clerkOrgId, organizationId, userId, userDbId } = requireOrgContext(c);
    const tenant = getTenant(c);
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const updated = await employeeService.updateProfile(
      getDb(c),
      organizationId,
      clerkOrgId,
      userId,
      tenant.organization.locale,
      userDbId,
      id,
      input,
      tenant.locations,
    );
    return c.json(updated, 200);
  }),
);

employeeRoutes.openapi(
  inviteRoute,
  defineRouteHandler(inviteRoute, async (c) => {
    const { clerkOrgId, organizationId, userId } = requireOrgContext(c);
    const tenant = getTenant(c);
    const { id } = c.req.valid("param");
    const updated = await employeeService.invite(
      getDb(c),
      organizationId,
      clerkOrgId,
      userId,
      tenant.organization.locale,
      id,
      tenant.locations,
    );
    return c.json(updated, 200);
  }),
);

employeeRoutes.openapi(
  revokeInvitationRoute,
  defineRouteHandler(revokeInvitationRoute, async (c) => {
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
  }),
);

employeeRoutes.openapi(deleteRouteDef, async (c) => {
  const { clerkOrgId, organizationId } = requireOrgContext(c);
  const { id } = c.req.valid("param");
  await employeeService.remove(getDb(c), organizationId, clerkOrgId, id);
  return c.body(null, 204);
});
