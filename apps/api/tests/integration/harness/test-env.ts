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
