import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  defineRouteHandler,
  errorResponse,
  jsonResponse,
} from "../../core/openapi/responses.js";
import { UnauthorizedError } from "../../core/errors/app-errors.js";
import { env } from "../../env.js";
import { getDb } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";
import { taskOccurrenceService } from "./task-occurrence.service.js";

function isCronSecret(candidate: string): boolean {
  const expected = Buffer.from(env.CRON_SECRET);
  const actual = Buffer.from(candidate);

  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

const requireCronSecret = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");

  if (!token || !isCronSecret(token)) {
    throw new UnauthorizedError();
  }

  await next();
});

export const taskOccurrenceRoutes = new OpenAPIHono<AppEnv>();

taskOccurrenceRoutes.use("*", requireCronSecret);

const materializeResponseSchema = z.object({
  organizations: z.number(),
  processed: z.number(),
  created: z.number(),
  replaced: z.number(),
  deleted: z.number(),
});

const materializeRoute = createRoute({
  method: "get",
  path: "/materialize",
  tags: ["Internal"],
  security: [{ Bearer: [] }],
  responses: {
    200: jsonResponse(materializeResponseSchema),
    401: errorResponse("Unauthorized"),
  },
});

taskOccurrenceRoutes.openapi(
  materializeRoute,
  defineRouteHandler(materializeRoute, async (c) => {
    const summary = await taskOccurrenceService.reconcileAllOrganizations(
      getDb(c),
    );
    return c.json(summary, 200);
  }),
);
