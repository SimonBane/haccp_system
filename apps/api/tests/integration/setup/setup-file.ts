import { afterAll, beforeEach, vi } from "vitest";
import { clerkFake } from "../harness/clerk-fake.js";

/**
 * Both exports must be replaced together: auth.ts imports `verifyToken` and
 * clerk-client.ts imports `createClerkClient` from the same specifier, so mocking
 * one leaves the other undefined at module init. `@clerk/backend/errors` stays
 * real — the API classifies failures by instanceof.
 */
vi.mock("@clerk/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/backend")>();

  return {
    ...actual,
    verifyToken: clerkFake.verifyToken,
    createClerkClient: () => clerkFake.client,
  };
});

const { logger } = await import("../../../src/lib/logger.js");

// Injected failures are logged by design; set INTEGRATION_LOG_LEVEL=debug to see them.
logger.level = process.env.INTEGRATION_LOG_LEVEL ?? "silent";

const { db, closeDb } = await import("../../../src/core/db/client.js");
const { closeRedis } = await import("../../../src/core/redis/client.js");
const { truncateAll } = await import("../harness/db.js");
const { flushTestRedis } = await import("../harness/redis.js");

beforeEach(async () => {
  // Clerk first so a fixture seeded in the test body registers against a clean
  // fake; caches last, or they would still describe the rows just deleted.
  clerkFake.reset();
  await truncateAll(db);
  await flushTestRedis();
});

afterAll(async () => {
  await closeRedis();
  await closeDb();
});
