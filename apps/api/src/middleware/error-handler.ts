import type { ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { apiErrorSchema } from "@haccp/shared";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import type { AppEnv } from "../types.js";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    }

    return c.json(
      err.toJSON(requestId),
      err.statusCode as ContentfulStatusCode,
    );
  }

  if (err instanceof ZodError) {
    const payload = apiErrorSchema.parse({
      error: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.flatten(),
      requestId,
    });

    return c.json(payload, 400);
  }

  logger.error({ err, requestId }, "Unhandled error");

  const payload = apiErrorSchema.parse({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    requestId,
  });

  return c.json(payload, 500);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get("requestId");

  const payload = apiErrorSchema.parse({
    error: "NOT_FOUND",
    message: "Route not found",
    requestId,
  });

  return c.json(payload, 404);
};
