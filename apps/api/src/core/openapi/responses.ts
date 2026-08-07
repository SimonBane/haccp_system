import { apiErrorSchema } from "@haccp/shared";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { z } from "zod";
import type { AppEnv } from "../../types.js";

/**
 * Bridges handler implementations to @hono/zod-openapi's RouteHandler type.
 * Required for Zod v4 schemas from workspace packages under stricter TS checks
 * (e.g. Vercel's Hono entrypoint typecheck).
 */
export function defineRouteHandler<R extends RouteConfig>(
  _route: R,
  handler: (c: Parameters<RouteHandler<R, AppEnv>>[0]) => unknown,
): RouteHandler<R, AppEnv> {
  return handler as unknown as RouteHandler<R, AppEnv>;
}

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
