import path from "node:path";
import { fileURLToPath } from "node:url";

// `new URL("..")` from support/ resolves to the package root; dirname() of it
// would climb one level too far, out of the package entirely.
export const e2eRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
);

export const WEB_BASE_URL = process.env.E2E_WEB_URL ?? "http://localhost:3000";
export const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:3001";

/** English so URLs carry the /en prefix and assertions can use messages/en.json. */
export const LOCALE_PREFIX = "/en";

export const storageStatePath = (role: string) =>
  path.join(e2eRoot, ".auth", `${role}.json`);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. See e2e/README.md for the Clerk dev instance setup this suite needs.`,
    );
  }
  return value;
}

/**
 * Emails only, no passwords: `clerk.signIn` mints a server-side token from
 * CLERK_SECRET_KEY, which also sidesteps the device-trust step that leaves a
 * password sign-in stuck on `needs_client_trust`.
 */
export const clerkEmails = {
  admin: () => required("E2E_CLERK_ADMIN_EMAIL"),
  employee: () => required("E2E_CLERK_EMPLOYEE_EMAIL"),
  noOrg: () => required("E2E_CLERK_NO_ORG_EMAIL"),
};

export const E2E_PREFIX = "E2E";

/**
 * A Clerk publishable key is `pk_<env>_<base64(frontendApiHost + "$")>`. Deriving the
 * host from it lets tests intercept Clerk's own network calls (e.g. token refresh)
 * without hardcoding a per-instance domain.
 */
export function clerkFrontendApiHost(): string {
  // Not E2E_CLERK_PUBLISHABLE_KEY: CI's job env (ci.yml) exports that secret's value
  // only under CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, and locally
  // playwright.config only loads apps/api/.env(.local), never apps/web/.env.local
  // where NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY lives. CLERK_PUBLISHABLE_KEY is present
  // in both.
  const key = required("CLERK_PUBLISHABLE_KEY");
  const encoded = key.replace(/^pk_(test|live)_/, "");
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  return decoded.replace(/\$$/, "");
}
