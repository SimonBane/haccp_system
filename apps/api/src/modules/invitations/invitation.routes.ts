// @ts-nocheck — Vercel Hono preset per-file TS cannot infer OpenAPI handler types reliably.
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  errorResponse,
  jsonResponse,
} from "../../core/openapi/route-factory.js";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../../core/errors/app-errors.js";
import { getDb } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { invitationService } from "./invitation.service.js";

const bearerSecurity = [{ Bearer: [] }];

const acceptInvitationResponseSchema = z.object({
  success: z.literal(true),
});

export const invitationRoutes = new OpenAPIHono<AppEnv>();

const acceptRoute = createRoute({
  method: "post",
  path: "/accept",
  tags: ["Invitations"],
  security: bearerSecurity,
  responses: {
    200: jsonResponse(acceptInvitationResponseSchema),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
  },
});

invitationRoutes.openapi(acceptRoute, async (c) => {
  const clerkOrgId = c.get("orgId");
  const clerkUserId = c.get("userId");
  const orgRole = c.get("orgRole");

  if (!clerkUserId || !orgRole) {
    throw new UnauthorizedError();
  }

  if (!clerkOrgId) {
    throw new ForbiddenError("Organization membership required");
  }

  await invitationService.accept(getDb(c), clerkOrgId, clerkUserId, orgRole);

  return c.json({ success: true as const }, 200);
});
