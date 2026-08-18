import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX } from "../../support/env.js";

test("a supported card action is visible and usable without a long press", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard/equipment`);

  const firstCard = page.getByTestId("data-table-card").first();
  await expect(firstCard).toBeVisible();

  const actionsButton = firstCard.getByTestId("data-table-card-actions");
  // Visible on render, not only after a long-press or keyboard focus.
  await expect(actionsButton).toBeVisible();

  await actionsButton.click();

  const menuItems = page.getByRole("menuitem");
  await expect(menuItems.first()).toBeVisible();
  expect(await menuItems.count()).toBeGreaterThan(0);
});
