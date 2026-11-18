import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

test("a row's actions are visible and usable on a phone without a long press", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard/targets`);

  // Long-press starts selecting, so the actions button must be reachable on its own.
  const actionsButton = page.getByRole("button", {
    name: `Actions for ${E2E_PREFIX} Fridge 01`,
  });
  await expect(actionsButton).toBeVisible();

  await actionsButton.click();

  const menuItems = page.getByRole("menuitem");
  await expect(menuItems.first()).toBeVisible();
  expect(await menuItems.count()).toBeGreaterThan(0);
});
