/**
 * Sentry is enabled only on Vercel production deploys.
 * Client bundles read NEXT_PUBLIC_VERCEL_ENV (inlined at build time via next.config).
 */
export function isSentryEnabled(): boolean {
  const vercelEnv =
    process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;

  return vercelEnv === "production";
}
