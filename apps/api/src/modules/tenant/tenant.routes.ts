import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { tenantContextResponseSchema } from "@haccp/shared";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import { getTenantContext } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";

const bearerSecurity = [{ Bearer: [] }];

export const tenantRoutes = new OpenAPIHono<AppEnv>();

const getCurrentTenantRoute = createRoute({
  method: "get",
  path: "/current",
  tags: ["Tenant"],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(tenantContextResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
  },
});

tenantRoutes.openapi(getCurrentTenantRoute, async (c) => {
  return c.json(getTenantContext(c), 200);
});
