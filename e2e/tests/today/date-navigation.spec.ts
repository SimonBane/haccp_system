import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX } from "../../support/env.js";

test("date navigation settles on the requested day when the fetch is slow", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await expect(page.getByTestId("today-task-row").first()).toBeVisible();

  const todayKeys = () =>
    page
      .getByTestId("today-task-row")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-occurrence-key")),
      );

  const initialKeys = await todayKeys();
  expect(initialKeys.length).toBeGreaterThan(0);

  // Route interception rather than an API-side delay: no production change, scoped
  // to this test, removable.
  await page.route("**/locations/*/today*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.getByTestId("date-nav-trigger").click();
  await page.getByTestId("date-nav-previous").click();

  // "Jump to today" only renders off today, so its appearance is the date actually changing.
  await page.getByTestId("date-nav-trigger").click();
  await expect(page.getByTestId("date-nav-today")).toBeVisible();

  await page.getByTestId("date-nav-today").click();
  await page.unroute("**/locations/*/today*");

  // Back on today with the same occurrences: the delayed response for the previous
  // day must not land on top of the current one.
  await expect.poll(todayKeys).toEqual(initialKeys);
});

// HACCP-59 owns the stricter assertion this journey should grow: that previous-day
// rows are not actionable while the fetch is in flight. Asserting it here would
// encode a known-open bug as the contract.
