import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../types.js";

const meResponseSchema = z.object({
  userId: z.string(),
  orgId: z.string().nullable(),
  orgRole: z.string().nullable(),
});

export const meRoutes = new OpenAPIHono<AppEnv>();

const meRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: meResponseSchema,
        },
      },
      description: "Authenticated user context from Clerk session",
    },
  },
  tags: ["Auth"],
});

meRoutes.openapi(meRoute, (c) => {
  return c.json({
    userId: c.get("userId"),
    orgId: c.get("orgId"),
    orgRole: c.get("orgRole"),
  });
});
