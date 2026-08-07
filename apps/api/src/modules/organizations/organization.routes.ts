import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  updateOrganizationNameSchema,
  updateOrganizationSchema,
  organizationResponseSchema,
} from "@haccp/shared";
import {
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { ValidationError } from "../../core/errors/app-errors.js";
import { getCurrentOrganization, getDb, getTenant, requireOrgContext } from "../../lib/context.js";
import { organizationService } from "./organization.service.js";
import type { AppEnv } from "../../types.js";

const bearerSecurity = [{ Bearer: [] }];

export const organizationRoutes = new OpenAPIHono<AppEnv>();

const patchCurrentRoute = createRoute({
  method: "patch",
  path: "/current",
  tags: ["Organizations"],
  security: bearerSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateOrganizationSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(organizationResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
  },
});

organizationRoutes.openapi(
  patchCurrentRoute,
  defineRouteHandler(patchCurrentRoute, async (c) => {
    const { clerkOrgId } = requireOrgContext(c);
    const tenant = getTenant(c);
    const input = c.req.valid("json");
    const updated = await organizationService.updateSettings(
      getDb(c),
      clerkOrgId,
      tenant.organization,
      tenant.locations.length,
      input,
    );

    return c.json(updated, 200);
  }),
);

const patchCurrentNameRoute = createRoute({
  method: "patch",
  path: "/current/name",
  tags: ["Organizations"],
  security: bearerSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateOrganizationNameSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(organizationResponseSchema),
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

organizationRoutes.openapi(
  patchCurrentNameRoute,
  defineRouteHandler(patchCurrentNameRoute, async (c) => {
    const { clerkOrgId } = requireOrgContext(c);
    const organization = getCurrentOrganization(c);
    const input = c.req.valid("json");
    const updated = await organizationService.updateName(
      getDb(c),
      clerkOrgId,
      organization,
      input,
    );

    return c.json(updated, 200);
  }),
);

organizationRoutes.put("/current/logo", async (c) => {
  const { clerkOrgId, userId } = requireOrgContext(c);
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    throw new ValidationError("Logo file is required");
  }

  const updated = await organizationService.uploadLogo(
    getDb(c),
    clerkOrgId,
    userId,
    file,
  );

  return c.json(updated, 200);
});

organizationRoutes.delete("/current/logo", async (c) => {
  const { clerkOrgId } = requireOrgContext(c);
  const updated = await organizationService.deleteLogo(getDb(c), clerkOrgId);

  return c.json(updated, 200);
});
