import * as Sentry from "@sentry/hono/node";
import { isSentryEnabled } from "./lib/sentry.js";

if (isSentryEnabled()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production",
    enableLogs: true,
    tracesSampleRate: 0.1,
    integrations: [Sentry.pinoIntegration()],
    tracesSampler: ({ name, inheritOrSampleWith }) => {
      if (name.includes("/health")) {
        return 0;
      }

      return inheritOrSampleWith(0.1);
    },
    beforeSendLog: (log) => {
      if (log.level === "debug" || log.level === "trace") {
        return null;
      }

      return log;
    },
  });
}
