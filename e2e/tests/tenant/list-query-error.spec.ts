import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

test("a failed equipment list request shows retry, not an empty list", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard/equipment`);
  await expect(page.getByText(`${E2E_PREFIX} Fridge 1`).first()).toBeVisible();

  // Switching location starts a fresh, uncached query for the new location — the
  // only way from a real user flow to force isError without stale data masking it.
  let requestsSeen = 0;
  await page.route("**/locations/*/equipment", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    requestsSeen += 1;
    await route.fulfill({ status: 500, body: "{}" });
  });

  await page.getByRole("button", { name: "Location" }).click();
  await page
    .getByRole("menuitemradio", { name: `${E2E_PREFIX} Annex` })
    .click();
  // Selecting a radio item doesn't close the menu on its own; its portal overlay
  // stays interactive and swallows the next click unless dismissed explicitly.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("menuitemradio", { name: `${E2E_PREFIX} Annex` }),
  ).toBeHidden();

  await expect(page.getByTestId("data-table-error")).toBeVisible();
  await expect(page.getByTestId("data-table-retry")).toBeVisible();
  await expect(page.getByText(`${E2E_PREFIX} Fridge 1`)).toHaveCount(0);
  expect(requestsSeen).toBeGreaterThan(0);

  await page.unroute("**/locations/*/equipment");
  await page.getByTestId("data-table-retry").click();

  await expect(page.getByTestId("data-table-error")).toBeHidden();
});
