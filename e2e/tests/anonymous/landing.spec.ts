import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX, storageStatePath } from "../../support/env.js";

test.describe("signed-out visitor", () => {
  test("sees the landing page and can start signing up", async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByTestId("landing-get-started").click();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("can reach sign-in from the landing page", async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}`);

    await page.getByTestId("landing-sign-in").click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("switches language from the header toggle", async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}`);

    await page.getByRole("button", { name: "Български" }).click();
    await expect(page).not.toHaveURL(/\/en(\/|$)/);
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });

  test.describe("on a dark-mode device", () => {
    test.use({ colorScheme: "dark" });

    test("follows the system theme and can switch to light", async ({
      page,
    }) => {
      await page.goto(`${LOCALE_PREFIX}`);
      const html = page.locator("html");

      await expect(html).toHaveClass(/\bdark\b/);
      await page.getByTestId("landing-theme-toggle").click();
      await expect(html).not.toHaveClass(/\bdark\b/);
    });
  });
});

test.describe("signed-in user", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("skips the landing page and goes to the dashboard", async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}`);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("landing-get-started")).toHaveCount(0);
  });
});
