import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry";
import { ApiRequestError } from "./api-utils";

const reportedErrors = new WeakSet<Error>();

export function shouldReportUnexpectedWebError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return (
      error.kind === "invalid_error_response" ||
      error.kind === "invalid_response"
    );
  }

  return true;
}

export function reportUnexpectedWebError(error: unknown): void {
  if (!isSentryEnabled() || !shouldReportUnexpectedWebError(error)) {
    return;
  }

  if (error instanceof Error) {
    if (reportedErrors.has(error)) {
      return;
    }
    reportedErrors.add(error);
  }

  Sentry.captureException(error, {
    tags:
      error instanceof ApiRequestError
        ? {
            api_error_code: error.code,
            ...(error.status !== undefined
              ? { http_status: String(error.status) }
              : {}),
            ...(error.requestId ? { request_id: error.requestId } : {}),
          }
        : undefined,
  });
}
