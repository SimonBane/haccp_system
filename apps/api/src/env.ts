import { z } from "zod";

export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? "http://localhost:3000")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ["http://localhost:3000"];
}

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  DIRECT_DATABASE_URL: z.url().optional(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  WEB_APP_URL: z.url().default("http://localhost:3000"),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, {
      error: "REDIS_URL must be a redis:// or rediss:// URL",
    }),
  // This is the bound on how long a revoked location assignment can remain usable — not a
  // performance knob. Keep it near Clerk's own session-token lifetime (60s default).
  MEMBERSHIP_CACHE_TTL_SECONDS: z.coerce.number().positive().default(60),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsedEnv = envSchema.parse({
  API_PORT: process.env.API_PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  WEB_APP_URL: process.env.WEB_APP_URL,
  REDIS_URL: process.env.REDIS_URL,
  MEMBERSHIP_CACHE_TTL_SECONDS: process.env.MEMBERSHIP_CACHE_TTL_SECONDS,
  NODE_ENV: process.env.NODE_ENV,
});

export const env = {
  ...parsedEnv,
  corsOrigins: parseCorsOrigins(parsedEnv.CORS_ORIGIN),
};
