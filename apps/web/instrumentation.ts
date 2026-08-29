import * as Sentry from "@sentry/nextjs";
import { shouldReportUnexpectedWebError } from "./src/lib/api/error-reporting";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = (
  ...args: Parameters<typeof Sentry.captureRequestError>
) => {
  if (shouldReportUnexpectedWebError(args[0])) {
    Sentry.captureRequestError(...args);
  }
};
