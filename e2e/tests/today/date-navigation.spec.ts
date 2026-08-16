import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX } from "../../support/env.js";

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
