import { getTracePropagationTargets } from "@/lib/sentry";
import { initSentry } from "./sentry.shared.config";
import * as Sentry from "@sentry/nextjs";

initSentry(Sentry, process.env.NEXT_PUBLIC_SENTRY_DSN, {
  integrations: [
    Sentry.browserTracingIntegration({
      shouldCreateSpanForRequest: (url) => !url.match(/\/health$/),
    }),
    Sentry.consoleLoggingIntegration({
      levels: ["warn", "error"],
    }),
  ],
  tracePropagationTargets: getTracePropagationTargets(),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
