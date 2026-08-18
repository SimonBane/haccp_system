import { z } from "zod";

const PLACEHOLDER_PATTERN = /\[[a-z-]+\]|changeme|placeholder|your[-_]?password/i;
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

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

// Gated on VERCEL_ENV, not NODE_ENV: `next build` always sets NODE_ENV=production
// (including local builds and CI's build-web check), while VERCEL_ENV=production
// is only set for an actual production deploy — mirroring @haccp/shared's
// isSentryEnabled, which enables Sentry on the same signal.
const envSchema = z
  .object({
    NEXT_PUBLIC_API_URL: z.string().default("http://localhost:3001"),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.VERCEL_ENV !== "production") {
      return;
    }

    if (
      !isProductionUrl(data.NEXT_PUBLIC_API_URL) ||
      isPlaceholder(data.NEXT_PUBLIC_API_URL)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_API_URL"],
        message:
          "NEXT_PUBLIC_API_URL must be a non-localhost https URL in production",
      });
    }

    if (
      !data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      isPlaceholder(data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
        message: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production",
      });
    }

    if (!data.CLERK_SECRET_KEY || isPlaceholder(data.CLERK_SECRET_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["CLERK_SECRET_KEY"],
        message: "CLERK_SECRET_KEY is required in production",
      });
    }
  });

// Issue messages above never echo the offending value, so a thrown ZodError
// never carries a secret into the build log.
function formatEnvError(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  return `Invalid environment configuration: ${issues}`;
}

function parseEnv() {
  try {
    return envSchema.parse({
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatEnvError(error));
    }
    throw error;
  }
}

export const env = parseEnv();
