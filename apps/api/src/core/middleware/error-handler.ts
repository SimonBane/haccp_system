import type { ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as Sentry from "@sentry/hono/node";
import { apiErrorSchema } from "@haccp/shared";
import { z, ZodError } from "zod";
import { AppError } from "../errors/app-errors.js";
import { logger } from "../../lib/logger.js";
import { isSentryEnabled } from "../../lib/sentry.js";
import type { AppEnv } from "../../types.js";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);

      // 503 means an upstream is down, not that we have a bug — don't flood Sentry.
      if (isSentryEnabled() && err.statusCode !== 503) {
        Sentry.captureException(err, { extra: { requestId } });
      }
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
      details: z.treeifyError(err),
      requestId,
    });

    return c.json(payload, 400);
  }

  logger.error({ err, requestId }, "Unhandled error");

  if (isSentryEnabled()) {
    Sentry.captureException(err, { extra: { requestId } });
  }

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
