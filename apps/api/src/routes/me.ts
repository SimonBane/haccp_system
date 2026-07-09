import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import type { AppEnv } from "../types.js";

const meResponseSchema = z.object({
  userId: z.string(),
  orgId: z.string().nullable(),
  orgRole: z.string().nullable(),
});

export const meRoutes = new OpenAPIHono<AppEnv>();

meRoutes.get("/", (c) => {
  return c.json(
    meResponseSchema.parse({
    userId: c.get("userId"),
    orgId: c.get("orgId"),
    orgRole: c.get("orgRole"),
    }),
    200,
  );
});
