/** Sentry only when `VERCEL_ENV=production`. Client reads `NEXT_PUBLIC_VERCEL_ENV`. */
export function isSentryEnabled(): boolean {
  const vercelEnv =
    process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;

  return vercelEnv === "production";
}
