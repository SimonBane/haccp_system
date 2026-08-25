import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import {
  dateRangeTrigger,
  ensureSubmittedRecord,
  filterTrigger,
  hasHorizontalOverflow,
  nextRecordsQuery,
  RECORDS_PATH,
} from "../../support/records.js";

const CLEANING_TASK = `${E2E_PREFIX} Clean prep surface`;

test("Records renders as a card list on a phone, with no horizontal scroll", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await ensureSubmittedRecord(page, CLEANING_TASK);

  await page.goto(RECORDS_PATH);

  const cards = page.getByTestId("data-table-card");
  await expect(cards.first()).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();

  // Pagination stays reachable on a phone — no infinite scroll replaces it.
  await expect(page.getByTestId("data-table-next-page")).toBeVisible();

  // The compact date and filter controls must not push the page sideways.
  await expect(dateRangeTrigger(page)).toBeVisible();
  await expect(filterTrigger(page, "Type")).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);

  const filtered = await nextRecordsQuery(page, async () => {
    await filterTrigger(page, "Type").click();
    await page.getByRole("checkbox", { name: "Cleaning" }).click();
    await page.keyboard.press("Escape");
  });
  expect(filtered.get("type")).toBe("cleaning");
  expect(await hasHorizontalOverflow(page)).toBe(false);

  // The print action is an icon-only control, so it must carry an accessible name.
  await expect(page.getByRole("link", { name: "Print report" })).toBeVisible();
});
