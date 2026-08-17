/**
 * Shared by vitest.integration.config.ts and setup/global-setup.ts. Global setup
 * runs in the Vitest main process, before `test.env` reaches any worker, so it
 * cannot read these from process.env.
 */

/** Dropped and recreated on every run. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://haccp:haccp@localhost:5432/haccp_test";

/** Logical DB 15, so FLUSHDB cannot reach a running dev app. */
export const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";

/**
 * Unlike the other Clerk env values (placeholders — the network boundary is
 * mocked), Svix verification in the webhook routes is real, not mocked, so this
 * has to be genuinely valid: `whsec_` + base64. A non-base64 placeholder here
 * would throw inside `standardwebhooks` before a signed test request ever
 * reaches the route. `harness/webhook-signing.ts` signs with this same value.
 */
export const TEST_CLERK_WEBHOOK_SIGNING_SECRET =
  process.env.TEST_CLERK_WEBHOOK_SIGNING_SECRET ??
  "whsec_PxIKRpaBKW7t8aJBEPyt9ynQQ6KeQSJ7nEFsyyK86sQ=";
