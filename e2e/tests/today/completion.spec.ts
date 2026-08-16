import { expect, test, type Page } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

/** The row card carries the state; the stretched overlay button is the click target. */
function row(page: Page, title: string) {
  return page.getByTestId("today-task-row").filter({ hasText: title }).first();
}

/**
 * A fully completed time group collapses, so after a reload the row is absent from
 * the DOM rather than present-and-completed. Reopen it before asserting.
 */
async function expandGroup(page: Page, scheduledTime: string) {
  const group = page
    .getByTestId("today-time-group")
    .filter({ has: page.locator(`[data-scheduled-time="${scheduledTime}"]`) })
    .or(page.locator(`[data-scheduled-time="${scheduledTime}"]`))
    .first();

  await expect(group).toBeVisible();

  if ((await group.getByTestId("today-task-row").count()) === 0) {
    await group.getByTestId("today-time-group-toggle").first().click();
  }
}

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
