import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** The row card carries the state; the stretched overlay button is the click target. */
export function row(page: Page, title: string) {
  return page.getByTestId("today-task-row").filter({ hasText: title }).first();
}

/**
 * A fully completed time group collapses, so a row a prior journey completed is
 * absent from the DOM rather than present-and-completed. Reopen it before asserting.
 */
export async function expandGroup(page: Page, scheduledTime: string) {
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

/**
 * The suite runs single-worker against one seeded org (`playwright.config.ts`:
 * `workers: 1`), so completion.spec.ts's two tests leave both seeded templates
 * completed by the time later specs run. Undo first so a test that needs a
 * pending row isn't at the mercy of file execution order.
 */
export async function ensurePending(
  page: Page,
  title: string,
  scheduledTime: string,
) {
  await expandGroup(page, scheduledTime);
  const target = row(page, title);
  await expect(target).toBeVisible();

  if ((await target.getAttribute("data-completed")) === "true") {
    await target.getByTestId("today-task-activate").click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(target).not.toHaveAttribute("data-completed", "true");
  }
}
