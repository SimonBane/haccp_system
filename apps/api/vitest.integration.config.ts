import { defineIntegrationConfig } from "@haccp/vitest-config/integration";
import {
  TEST_CLERK_WEBHOOK_SIGNING_SECRET,
  TEST_DATABASE_URL,
  TEST_REDIS_URL,
} from "./tests/integration/harness/test-env.js";

export default defineIntegrationConfig({
  test: {
    globalSetup: ["./tests/integration/setup/global-setup.ts"],
    setupFiles: ["./tests/integration/setup/setup-file.ts"],
    // src/env.ts parses at import and the app reaches it through the db and Clerk
    // clients, so these must be set before the first import, not in a beforeAll.
    // CLERK_SECRET_KEY/PUBLISHABLE_KEY are placeholders — that network boundary
    // is mocked. CLERK_WEBHOOK_SIGNING_SECRET is not: Svix verification in the
    // webhook routes is real, so it must be a genuinely valid whsec_ secret.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: TEST_REDIS_URL,
      CLERK_SECRET_KEY: "sk_test_integration",
      CLERK_PUBLISHABLE_KEY: "pk_test_integration",
      CLERK_WEBHOOK_SIGNING_SECRET: TEST_CLERK_WEBHOOK_SIGNING_SECRET,
      MEMBERSHIP_CACHE_TTL_SECONDS: "2",
    },
  },
});
