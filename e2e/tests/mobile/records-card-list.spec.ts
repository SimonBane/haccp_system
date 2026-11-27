import { expect, test } from "@playwright/test";
import { CLEANING_FORM_NAME } from "../../support/forms.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import {
  dateRangeTrigger,
  ensureSubmittedRecord,
  filtersMenu,
  hasHorizontalOverflow,
  isRecordsListRequest,
  RECORDS_PATH,
  recordsSearch,
} from "../../support/records.js";

const CLEANING_TASK = CLEANING_FORM_NAME;

test("Records renders as a day list on a phone, with no horizontal scroll", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await ensureSubmittedRecord(page, { title: CLEANING_TASK });

  await page.goto(RECORDS_PATH);

  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();
  await expect(dateRangeTrigger(page)).toBeVisible();

  // A phone lists every check: no search box or filter menu.
  await expect(recordsSearch(page)).toHaveCount(0);
  await expect(filtersMenu(page)).toHaveCount(0);
  expect(await hasHorizontalOverflow(page)).toBe(false);

  // The list grows in place rather than paging.
  const showMore = page.getByRole("button", { name: "Show more" });
  if (await showMore.isVisible()) {
    const request = page.waitForRequest(isRecordsListRequest);
    await showMore.click();
    expect(new URL((await request).url()).searchParams.get("page")).toBe("2");
  }

  // The print action is an icon-only control, so it must carry an accessible name.
  await expect(page.getByRole("button", { name: "Print report" })).toBeVisible();
});
