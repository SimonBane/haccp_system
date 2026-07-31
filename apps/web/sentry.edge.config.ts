import * as Sentry from "@sentry/nextjs";
import { initSentry } from "./sentry.shared.config";

initSentry(Sentry, process.env.SENTRY_DSN);
