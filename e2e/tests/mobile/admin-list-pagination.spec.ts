import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

test("an admin can reach every piece of equipment on a phone", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard/targets`);

  await expect(page.getByText(`${E2E_PREFIX} Fridge 01`)).toBeVisible();

  // The list is not paged: an item past the first screenful is reached by scrolling.
  const later = page.getByText(`${E2E_PREFIX} Fridge 11`);
  await later.scrollIntoViewIfNeeded();
  await expect(later).toBeVisible();
});
