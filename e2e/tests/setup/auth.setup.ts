import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  clerkEmails,
  LOCALE_PREFIX,
  storageStatePath,
} from "../../support/env.js";

setup.describe.configure({ mode: "serial" });

setup("obtain a Clerk testing token", async () => {
  // Bypasses bot protection for the whole run; without it sign-in hits a captcha.
  await clerkSetup();
});

async function signInAndSave(
  page: import("@playwright/test").Page,
  role: "admin" | "employee" | "noOrg",
  landingPath: string,
) {
  // An unprotected page that loads Clerk but renders no Clerk component: signing in
  // from /sign-in fails silently, because the mounted <SignIn> owns the flow.
  await page.goto(`${LOCALE_PREFIX}/forbidden`);
  await clerk.signIn({ page, emailAddress: clerkEmails[role]() });

  await page.goto(landingPath);
  await page.waitForURL(`**${landingPath}`);

  const file = storageStatePath(role);
  await mkdir(path.dirname(file), { recursive: true });
  await page.context().storageState({ path: file });
}

setup("authenticate as an organization admin", async ({ page }) => {
  await signInAndSave(page, "admin", `${LOCALE_PREFIX}/dashboard`);
  // The dashboard layout bounces to /no-organization when the session carries no
  // org, so landing here at all proves the org claim was minted.
  await expect(page).toHaveURL(new RegExp(`${LOCALE_PREFIX}/dashboard`));
});

setup("authenticate as an employee", async ({ page }) => {
  await signInAndSave(page, "employee", `${LOCALE_PREFIX}/dashboard`);
});

setup("authenticate as a user with no organization", async ({ page }) => {
  await signInAndSave(page, "noOrg", `${LOCALE_PREFIX}/no-organization`);
});
