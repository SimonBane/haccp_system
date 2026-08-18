import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import { ensurePending, expandGroup, row } from "../../support/today.js";

test.describe("Today completions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
  });

  test("completing a task survives a reload", async ({ page }) => {
    const title = `${E2E_PREFIX} Clean prep surface`;
    // A retry of this same test leaves the task completed from the failed
    // attempt, collapsing its group — reset it so the row is there to click.
    await ensurePending(page, title, "09:00");

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
    await ensurePending(page, title, "08:00");

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
