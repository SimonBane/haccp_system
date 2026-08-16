import { defineUnitConfig } from "@haccp/vitest-config/unit";

// src/env.ts validates on import, and most modules reach it transitively through
// the Clerk client or the db client. These are inert placeholders that satisfy
// the schema — no test here opens a connection or calls an upstream. Anything
// that needs a real database belongs in an integration suite, not this one.
export default defineUnitConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      CLERK_SECRET_KEY: "sk_test_placeholder",
      CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
      REDIS_URL: "redis://localhost:6379",
    },
  },
});
