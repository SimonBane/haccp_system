import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

test.describe("Today completions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
  });

  test("completing a task survives a reload", async ({ page }) => {
    const row = page
      .getByTestId("today-task-row")
      .filter({ hasNot: page.locator("[data-completed]") })
      .first();

    const occurrenceKey = await row.getAttribute("data-occurrence-key");
    await row.click();

    const completed = page.locator(
      `[data-occurrence-key="${occurrenceKey}"][data-completed]`,
    );
    await expect(completed).toBeVisible();

    // The optimistic patch alone would satisfy the assertion above; only a reload
    // distinguishes a real write, which is the compliance guarantee here.
    await page.reload();
    await expect(
      page.locator(`[data-occurrence-key="${occurrenceKey}"][data-completed]`),
    ).toBeVisible();
  });

  test("recording a temperature survives a reload", async ({ page }) => {
    const row = page
      .getByTestId("today-task-row")
      .filter({ hasText: `${E2E_PREFIX} Fridge check` })
      .first();

    const occurrenceKey = await row.getAttribute("data-occurrence-key");
    await row.click();

    const reading = page.getByTestId("temperature-reading");
    await expect(reading).toBeVisible();
    await reading.fill("2");
    await page.getByTestId("temperature-save").click();

    await expect(
      page.locator(`[data-occurrence-key="${occurrenceKey}"][data-completed]`),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.locator(`[data-occurrence-key="${occurrenceKey}"][data-completed]`),
    ).toBeVisible();
  });
});
