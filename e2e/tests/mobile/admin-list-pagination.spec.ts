import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

test("an admin can reach past the first page of equipment on a phone", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard/equipment`);

  const cards = page.getByTestId("data-table-card");
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(10);

  // Fails on main: the pagination controls were suppressed for card lists, so the
  // 11th row existed but was unreachable on a phone.
  const nextPage = page.getByTestId("data-table-next-page");
  await expect(nextPage).toBeVisible();
  await nextPage.click();

  await expect(page.getByText(`${E2E_PREFIX} Fridge 11`)).toBeVisible();
});
