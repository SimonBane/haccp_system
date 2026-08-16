import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import {
  API_BASE_URL,
  e2eRoot,
  storageStatePath,
  WEB_BASE_URL,
} from "./support/env.js";

// Local runs only: `start:ci` deliberately reads no env files, and CI sets these at
// the job level. Never overrides what is already exported.
for (const file of [
  path.join(e2eRoot, ".env.local"),
  path.join(e2eRoot, "../apps/api/.env"),
  path.join(e2eRoot, "../apps/api/.env.local"),
]) {
  loadEnv({ path: file, override: false, quiet: true });
}

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  // One API, one web server, one Clerk dev instance, one database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["junit", { outputFile: "results/e2e.junit.xml" }],
      ]
    : [["list"]],

  use: {
    baseURL: WEB_BASE_URL,
    testIdAttribute: "data-testid",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    // localePrefix is "as-needed" with bg as default and localeDetection on, so an
    // unpinned locale changes both the URLs and every visible string.
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    timezoneId: "Europe/Sofia",
  },

  projects: [
    { name: "auth", testMatch: /setup\/auth\.setup\.ts/ },
    // Seeding needs the admin storage state that `auth` writes.
    {
      name: "seed",
      testMatch: /setup\/seed\.setup\.ts/,
      dependencies: ["auth"],
    },
    {
      name: "desktop",
      dependencies: ["seed"],
      testIgnore: [/setup\//, /mobile\//, /anonymous\//],
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageStatePath("admin"),
      },
    },
    {
      name: "mobile",
      dependencies: ["seed"],
      testMatch: /mobile\//,
      // 412px, below the 768 MOBILE_BREAKPOINT that switches tables to card lists.
      use: { ...devices["Pixel 7"], storageState: storageStatePath("admin") },
    },
    {
      name: "anonymous",
      dependencies: ["auth"],
      testMatch: /anonymous\//,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @haccp/api start:ci",
      url: `${API_BASE_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @haccp/web start",
      url: `${WEB_BASE_URL}/en`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
