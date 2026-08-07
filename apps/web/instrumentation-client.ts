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

const CHUNK_RELOAD_KEY = "haccp-chunk-reload";

function isChunkLoadFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";

  return /chunk|dynamically imported module|import\(/i.test(message);
}

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadFailure(event.reason)) {
      return;
    }

    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      return;
    }

    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  });

  window.addEventListener("load", () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
