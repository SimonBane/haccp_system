import { createMiddleware } from "hono/factory";
import * as Sentry from "@sentry/hono/node";
import { isSentryEnabled } from "../../lib/sentry.js";
import type { AppEnv } from "../../types.js";

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  if (isSentryEnabled()) {
    Sentry.getIsolationScope().setAttribute("request_id", requestId);
  }

  await next();
});
