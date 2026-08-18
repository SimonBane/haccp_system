import { expect, test, type Page } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

/** The row card carries the state; the stretched overlay button is the click target. */
function row(page: Page, title: string) {
  return page.getByTestId("today-task-row").filter({ hasText: title }).first();
}

test("date navigation settles on the requested day when the fetch is slow", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);

  // "Jump to today" renders only when the view is off today, so its presence is the
  // signal. Task rows are not: a fully completed day collapses every group, so what
  // is in the DOM depends on what earlier journeys did.
  const jumpToToday = page.getByTestId("date-nav-today");

  await page.getByTestId("date-nav-trigger").click();
  await expect(jumpToToday).toBeHidden();
  await page.keyboard.press("Escape");

  // Route interception rather than an API-side delay: no production change, scoped
  // to this test, removable.
  await page.route("**/locations/*/today*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.getByTestId("date-nav-trigger").click();
  await page.getByTestId("date-nav-previous").click();

  // The date moved while the response was still in flight.
  await expect(jumpToToday).toBeVisible();

  await page.unroute("**/locations/*/today*");

  // Reloading rather than clicking back through the popover: it animates on the date
  // change and the button detaches mid-click.
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await page.getByTestId("date-nav-trigger").click();
  await expect(jumpToToday).toBeHidden();
});

test("a tap during a delayed date switch never writes to the stale date", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  const title = `${E2E_PREFIX} Clean prep surface`;
  await expect(row(page, title)).toBeVisible();

  let writeCount = 0;
  await page.route("**/locations/*/today*", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } else {
      writeCount += 1;
    }
    await route.continue();
  });

  await page.getByTestId("date-nav-trigger").click();
  await page.getByTestId("date-nav-previous").click();
  await page.keyboard.press("Escape");

  // The previous date's response is still on screen while the new date's fetch is
  // in flight — tapping now must not write against the (now stale) date it renders.
  await row(page, title).getByTestId("today-task-activate").click();
  await page.waitForTimeout(200);

  await page.unroute("**/locations/*/today*");
  await page.waitForTimeout(1600);

  expect(writeCount).toBe(0);
});

test("switching dates closes an open temperature round", async ({ page }) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  const title = `${E2E_PREFIX} Fridge check`;
  await row(page, title).getByTestId("today-task-activate").click();

  const reading = page.getByTestId("temperature-reading");
  await expect(reading).toBeVisible();

  // `force: true`: the round dialog's overlay may sit above the sticky header, and
  // that overlap is a separate, pre-existing UI concern — this test isolates
  // whether a date change closes the round, not whether this exact click path is
  // reachable through the overlay.
  await page.getByTestId("date-nav-trigger").click({ force: true });
  await page.getByTestId("date-nav-previous").click({ force: true });

  await expect(reading).toBeHidden();
});
