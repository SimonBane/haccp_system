import { apiErrorSchema } from "@haccp/shared";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { z } from "zod";
import type { AppEnv } from "../../types.js";

/** Zod v4 handler cast — workspace schemas fail the RouteHandler check otherwise. */
export function defineRouteHandler<R extends RouteConfig>(
  _route: R,
  handler: (c: Parameters<RouteHandler<R, AppEnv>>[0]) => unknown,
): RouteHandler<R, AppEnv> {
  return handler as unknown as RouteHandler<R, AppEnv>;
}

export const bearerSecurity = [{ Bearer: [] }];

export function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  };
}

export function jsonResponse<T extends z.ZodType>(
  schema: T,
  description = "Success",
) {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}
