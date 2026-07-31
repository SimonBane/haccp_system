import type * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry";

export const sentryInitOptions: Sentry.NodeOptions = {
  environment: "production",
  enableLogs: true,
  tracesSampleRate: 0.1,
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
};

export function initSentry(
  SentrySdk: typeof Sentry,
  dsn: string | undefined,
  options?: Sentry.NodeOptions,
): void {
  if (!isSentryEnabled() || !dsn) {
    return;
  }

  SentrySdk.init({
    ...sentryInitOptions,
    dsn,
    ...options,
  });
}
