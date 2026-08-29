import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as Sentry from "@sentry/hono/node";
import { API_ERROR_CODE, apiErrorSchema } from "@haccp/shared";
import { z, ZodError } from "zod";
import { AppError } from "../errors/app-errors.js";
import { logger } from "../../lib/logger.js";
import { isSentryEnabled } from "../../lib/sentry.js";
import type { AppEnv } from "../../types.js";

function validationPayload(error: ZodError, requestId: string) {
  return apiErrorSchema.parse({
    error: API_ERROR_CODE.VALIDATION,
    message: "Validation failed",
    details: z.treeifyError(error),
    requestId,
  });
}

function captureServerError(
  error: unknown,
  requestId: string,
  code: string,
  statusCode: number,
): void {
  Sentry.captureException(error, {
    tags: {
      request_id: requestId,
      api_error_code: code,
      http_status: String(statusCode),
    },
  });
}

export const validationHook = (
  result: { success: boolean; error?: ZodError },
  c: Context<AppEnv>,
): Response | void => {
  if (!result.success && result.error) {
    return c.json(validationPayload(result.error, c.get("requestId")), 400);
  }
};

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);

      if (isSentryEnabled() && err.statusCode !== 503) {
        captureServerError(err, requestId, err.code, err.statusCode);
      }

      const payload = apiErrorSchema.parse({
        error:
          err.statusCode === 503
            ? API_ERROR_CODE.SERVICE_UNAVAILABLE
            : API_ERROR_CODE.INTERNAL,
        message:
          err.statusCode === 503
            ? "Service temporarily unavailable"
            : "An unexpected error occurred",
        requestId,
      });

      return c.json(payload, err.statusCode as ContentfulStatusCode);
    }

    return c.json(
      err.toJSON(requestId),
      err.statusCode as ContentfulStatusCode,
    );
  }

  if (err instanceof ZodError) {
    return c.json(validationPayload(err, requestId), 400);
  }

  logger.error({ err, requestId }, "Unhandled error");

  if (isSentryEnabled()) {
    captureServerError(err, requestId, API_ERROR_CODE.INTERNAL, 500);
  }

  const payload = apiErrorSchema.parse({
    error: API_ERROR_CODE.INTERNAL,
    message: "An unexpected error occurred",
    requestId,
  });

  return c.json(payload, 500);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get("requestId");

  const payload = apiErrorSchema.parse({
    error: API_ERROR_CODE.NOT_FOUND,
    message: "Route not found",
    requestId,
  });

  return c.json(payload, 404);
};
