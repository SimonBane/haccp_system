import { defineIntegrationConfig } from "@haccp/vitest-config/integration";
import {
  TEST_DATABASE_URL,
  TEST_REDIS_URL,
} from "./tests/integration/harness/test-env.js";

export default defineIntegrationConfig({
  test: {
    globalSetup: ["./tests/integration/setup/global-setup.ts"],
    setupFiles: ["./tests/integration/setup/setup-file.ts"],
    // src/env.ts parses at import and the app reaches it through the db and Clerk
    // clients, so these must be set before the first import, not in a beforeAll.
    // Clerk values are placeholders — the network boundary is mocked.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: TEST_REDIS_URL,
      CLERK_SECRET_KEY: "sk_test_integration",
      CLERK_PUBLISHABLE_KEY: "pk_test_integration",
      CLERK_WEBHOOK_SIGNING_SECRET: "whsec_test_integration",
      CRON_SECRET: "test-cron-secret-integration",
    },
  },
});
