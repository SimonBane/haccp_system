import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import { expandGroup, row } from "../../support/today.js";

test.describe("Today completions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
    await expect(page.getByTestId("today-task-row").first()).toBeVisible();
  });

  test("completing a task survives a reload", async ({ page }) => {
    const title = `${E2E_PREFIX} Clean prep surface`;
    await row(page, title).getByTestId("today-task-activate").click();
    await expect(row(page, title)).toHaveAttribute("data-completed", "true");

    // The optimistic patch alone would satisfy the assertion above; only a reload
    // distinguishes a real write, which is the compliance guarantee here.
    await page.reload();
    await expandGroup(page, "09:00");
    await expect(row(page, title)).toHaveAttribute("data-completed", "true");
  });

  test("recording a temperature survives a reload", async ({ page }) => {
    const title = `${E2E_PREFIX} Fridge check`;
    await row(page, title).getByTestId("today-task-activate").click();

    const reading = page.getByTestId("temperature-reading");
    await expect(reading).toBeVisible();
    await reading.fill("2");
    await page.getByTestId("temperature-save").click();

    await expect(row(page, title)).toHaveAttribute("data-completed", "true");

    await page.reload();
    await expandGroup(page, "08:00");
    await expect(row(page, title)).toHaveAttribute("data-completed", "true");
  });
});
