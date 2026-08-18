import { z } from "zod";

const PLACEHOLDER_PATTERN = /\[[a-z-]+\]|changeme|placeholder|your[-_]?password/i;
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? "http://localhost:3000")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ["http://localhost:3000"];
}

function isProductionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !LOCALHOST_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value);
}

const envSchema = z
  .object({
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
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") {
      return;
    }

    if (!isProductionUrl(data.WEB_APP_URL) || isPlaceholder(data.WEB_APP_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["WEB_APP_URL"],
        message: "WEB_APP_URL must be a non-localhost https URL in production",
      });
    }

    for (const origin of parseCorsOrigins(data.CORS_ORIGIN)) {
      if (!isProductionUrl(origin) || isPlaceholder(origin)) {
        ctx.addIssue({
          code: "custom",
          path: ["CORS_ORIGIN"],
          message: "CORS_ORIGIN must list only non-localhost https origins in production",
        });
        break;
      }
    }

    if (isPlaceholder(data.DATABASE_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL must not contain a placeholder value in production",
      });
    }

    if (isPlaceholder(data.REDIS_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "REDIS_URL must not contain a placeholder value in production",
      });
    } else {
      const redisHost = data.REDIS_URL.replace(/^rediss?:\/\/(?:[^@/]*@)?/, "").split(
        /[:/]/,
      )[0];
      if (redisHost && LOCALHOST_HOSTS.has(redisHost)) {
        ctx.addIssue({
          code: "custom",
          path: ["REDIS_URL"],
          message: "REDIS_URL must not point to localhost in production",
        });
      }
    }

    if (!data.CLERK_WEBHOOK_SIGNING_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["CLERK_WEBHOOK_SIGNING_SECRET"],
        message: "CLERK_WEBHOOK_SIGNING_SECRET is required in production",
      });
    } else if (isPlaceholder(data.CLERK_WEBHOOK_SIGNING_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["CLERK_WEBHOOK_SIGNING_SECRET"],
        message: "CLERK_WEBHOOK_SIGNING_SECRET must not contain a placeholder value in production",
      });
    }

    if (isPlaceholder(data.CLERK_SECRET_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["CLERK_SECRET_KEY"],
        message: "CLERK_SECRET_KEY must not contain a placeholder value in production",
      });
    }

    if (isPlaceholder(data.CLERK_PUBLISHABLE_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["CLERK_PUBLISHABLE_KEY"],
        message: "CLERK_PUBLISHABLE_KEY must not contain a placeholder value in production",
      });
    }
  });

// Issue messages are built above without echoing the offending value, so a thrown
// ZodError never carries a secret into logs or the startup error output.
function formatEnvError(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  return `Invalid environment configuration: ${issues}`;
}

function parseEnv() {
  try {
    return envSchema.parse({
      API_PORT: process.env.API_PORT,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
      CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
      WEB_APP_URL: process.env.WEB_APP_URL,
      REDIS_URL: process.env.REDIS_URL,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatEnvError(error));
    }
    throw error;
  }
}

const parsedEnv = parseEnv();

export const env = {
  ...parsedEnv,
  corsOrigins: parseCorsOrigins(parsedEnv.CORS_ORIGIN),
};
