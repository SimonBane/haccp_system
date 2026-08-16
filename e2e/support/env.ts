import path from "node:path";
import { fileURLToPath } from "node:url";

export const e2eRoot = path.dirname(
  fileURLToPath(new URL("../", import.meta.url)),
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

export const clerkCredentials = {
  admin: () => ({
    email: required("E2E_CLERK_ADMIN_EMAIL"),
    password: required("E2E_CLERK_ADMIN_PASSWORD"),
  }),
  employee: () => ({
    email: required("E2E_CLERK_EMPLOYEE_EMAIL"),
    password: required("E2E_CLERK_EMPLOYEE_PASSWORD"),
  }),
  noOrg: () => ({
    email: required("E2E_CLERK_NO_ORG_EMAIL"),
    password: required("E2E_CLERK_NO_ORG_PASSWORD"),
  }),
};

export const E2E_PREFIX = "E2E";
