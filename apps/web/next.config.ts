import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
// Side-effect import: throws before the config below is evaluated if a
// production deploy is missing a required env var, failing the build early.
import "./src/env.ts";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@haccp/shared"],
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "simeon-banev",
  project: "haccp-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
});
