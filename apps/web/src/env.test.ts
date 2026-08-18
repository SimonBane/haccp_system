import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "VERCEL_ENV",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const;

const VALID_PRODUCTION_ENV = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_API_URL: "https://api.example.com",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_realvalue",
  CLERK_SECRET_KEY: "sk_live_realvalue",
} as const;

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

describe("env when VERCEL_ENV=production", () => {
  it("accepts a fully valid production configuration", async () => {
    applyEnv(VALID_PRODUCTION_ENV);

    await expect(loadEnv()).resolves.toBeDefined();
  });

  it("rejects a missing NEXT_PUBLIC_API_URL (falls back to the localhost default)", async () => {
    applyEnv({ ...VALID_PRODUCTION_ENV, NEXT_PUBLIC_API_URL: undefined });

    await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a localhost NEXT_PUBLIC_API_URL", async () => {
    applyEnv({
      ...VALID_PRODUCTION_ENV,
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
    });

    await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects an insecure (http) public API URL", async () => {
    applyEnv({
      ...VALID_PRODUCTION_ENV,
      NEXT_PUBLIC_API_URL: "http://api.example.com",
    });

    await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a missing Clerk publishable key", async () => {
    applyEnv({
      ...VALID_PRODUCTION_ENV,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
    });

    await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  });

  it("rejects a missing Clerk secret key", async () => {
    applyEnv({ ...VALID_PRODUCTION_ENV, CLERK_SECRET_KEY: undefined });

    await expect(loadEnv()).rejects.toThrow(/CLERK_SECRET_KEY/);
  });

  it("never includes the offending secret value in the thrown error", async () => {
    const secretValue = "sk_super_secret_do_not_leak";
    applyEnv({
      ...VALID_PRODUCTION_ENV,
      CLERK_SECRET_KEY: `${secretValue}_placeholder`,
    });

    await expect(loadEnv()).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return !message.includes(secretValue);
    });
  });
});

describe("env outside of production (VERCEL_ENV unset)", () => {
  it("accepts the documented localhost defaults", async () => {
    applyEnv({});

    const { env } = await loadEnv();

    expect(env.NEXT_PUBLIC_API_URL).toBe("http://localhost:3001");
  });

  it("accepts a preview deploy without Clerk keys set", async () => {
    applyEnv({ VERCEL_ENV: "preview" });

    await expect(loadEnv()).resolves.toBeDefined();
  });
});
