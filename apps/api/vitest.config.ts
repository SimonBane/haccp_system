import { defineUnitConfig } from "@haccp/vitest-config/unit";

// src/env.ts validates on import; placeholders only — nothing here opens a real connection.
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
