import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@db.example.com:6543/haccp",
  REDIS_URL: "rediss://user:pass@redis.example.com:6379",
  CLERK_SECRET_KEY: "sk_live_realvalue",
  CLERK_PUBLISHABLE_KEY: "pk_live_realvalue",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_realvalue",
  CRON_SECRET: "a_real_cron_secret_value",
  WEB_APP_URL: "https://app.example.com",
  CORS_ORIGIN: "https://app.example.com",
} as const;

const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "REDIS_URL",
  "CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "CRON_SECRET",
  "WEB_APP_URL",
  "CORS_ORIGIN",
  "API_PORT",
] as const;

function applyEnv(overrides: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

async function loadEnv() {
  vi.resetModules();
  return import("./env.js");
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("env in production", () => {
  it("accepts a fully valid production configuration", async () => {
    applyEnv(BASE_ENV);

    await expect(loadEnv()).resolves.toBeDefined();
  });

  it("rejects a localhost WEB_APP_URL", async () => {
    applyEnv({ ...BASE_ENV, WEB_APP_URL: "http://localhost:3000" });

    await expect(loadEnv()).rejects.toThrow(/WEB_APP_URL/);
  });

  it("rejects a missing CORS_ORIGIN falling back to the localhost default", async () => {
    applyEnv({ ...BASE_ENV, CORS_ORIGIN: undefined });

    await expect(loadEnv()).rejects.toThrow(/CORS_ORIGIN/);
  });

  it("rejects an insecure (http) public CORS origin", async () => {
    applyEnv({ ...BASE_ENV, CORS_ORIGIN: "http://app.example.com" });

    await expect(loadEnv()).rejects.toThrow(/CORS_ORIGIN/);
  });

  it("rejects a malformed CORS origin", async () => {
    applyEnv({ ...BASE_ENV, CORS_ORIGIN: "not-a-url" });

    await expect(loadEnv()).rejects.toThrow(/CORS_ORIGIN/);
  });

  it("rejects a placeholder DATABASE_URL", async () => {
    applyEnv({
      ...BASE_ENV,
      DATABASE_URL:
        "postgresql://postgres:[YOUR-PASSWORD]@db.example.com:6543/haccp",
    });

    await expect(loadEnv()).rejects.toThrow(/DATABASE_URL/);
  });

  it("rejects a localhost REDIS_URL", async () => {
    applyEnv({ ...BASE_ENV, REDIS_URL: "redis://localhost:6379" });

    await expect(loadEnv()).rejects.toThrow(/REDIS_URL/);
  });

  it("rejects startup when the Clerk webhook signing secret is missing", async () => {
    applyEnv({ ...BASE_ENV, CLERK_WEBHOOK_SIGNING_SECRET: undefined });

    await expect(loadEnv()).rejects.toThrow(/CLERK_WEBHOOK_SIGNING_SECRET/);
  });

  it("rejects a placeholder Clerk secret key", async () => {
    applyEnv({ ...BASE_ENV, CLERK_SECRET_KEY: "changeme" });

    await expect(loadEnv()).rejects.toThrow(/CLERK_SECRET_KEY/);
  });

  it("rejects a missing CRON_SECRET", async () => {
    applyEnv({ ...BASE_ENV, CRON_SECRET: undefined });

    await expect(loadEnv()).rejects.toThrow(/CRON_SECRET/);
  });

  it("rejects a placeholder CRON_SECRET", async () => {
    applyEnv({ ...BASE_ENV, CRON_SECRET: "changeme" });

    await expect(loadEnv()).rejects.toThrow(/CRON_SECRET/);
  });

  it("never includes the offending secret value in the thrown error", async () => {
    const secretValue = "whsec_super_secret_do_not_leak";
    applyEnv({
      ...BASE_ENV,
      CLERK_WEBHOOK_SIGNING_SECRET: `${secretValue}_placeholder`,
    });

    await expect(loadEnv()).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return !message.includes(secretValue);
    });
  });
});

describe("env in development", () => {
  it("accepts the documented localhost defaults", async () => {
    applyEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://haccp:haccp@localhost:5432/haccp",
      REDIS_URL: "redis://localhost:6379",
      CLERK_SECRET_KEY: "sk_test_placeholder",
      CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
      CRON_SECRET: "dev-cron-secret",
    });

    const { env } = await loadEnv();

    expect(env.WEB_APP_URL).toBe("http://localhost:3000");
    expect(env.corsOrigins).toEqual(["http://localhost:3000"]);
  });
});
