// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  updateOrganizationSchema,
  organizationResponseSchema,
} from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { ForbiddenError } from "../../core/errors/app-errors.js";
import { getDb, requireOrgContext } from "../../lib/context.js";
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

organizationRoutes.openapi(patchCurrentRoute, async (c) => {
  if (c.get("orgRole") !== "org:admin") {
    throw new ForbiddenError("Admin access required");
  }

  const { clerkOrgId } = requireOrgContext(c);
  const input = c.req.valid("json");
  const updated = await organizationService.updateSettings(
    getDb(c),
    clerkOrgId,
    input,
  );

  return c.json(updated, 200);
});
