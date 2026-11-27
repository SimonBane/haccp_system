import { expect, test, type Page } from "@playwright/test";
import { CLEANING_FORM_NAME } from "../../support/forms.js";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import {
  dateRangeTrigger,
  ensureSubmittedRecord,
  isRecordsListRequest,
  nextRecordsQuery,
  openDateRange,
  printHref,
  recordsSearch,
  RECORDS_PATH,
  recordsTable,
  toggleFilterOption,
} from "../../support/records.js";

const CLEANING_TASK = CLEANING_FORM_NAME;

/**
 * The server render answers the default request and the list seeds it, so the first page
 * costs no client fetch. That makes the print link — built from the same local state —
 * the way to read the active range without forcing a request.
 */
async function activeRange(page: Page): Promise<{ from: string; to: string }> {
  const params = new URL(await printHref(page), "http://localhost")
    .searchParams;

  return { from: params.get("dateFrom")!, to: params.get("dateTo")! };
}

function spanInDays(range: { from: string; to: string }): number {
  return (
    (Date.parse(`${range.to}T00:00:00Z`) -
      Date.parse(`${range.from}T00:00:00Z`)) /
    86_400_000
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await ensureSubmittedRecord(page, { title: CLEANING_TASK });
});

test("an admin reaches Records from the sidebar and lands on the default range", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);

  await page.getByRole("link", { name: "Records" }).click();
  await expect(page).toHaveURL(new RegExp(`${RECORDS_PATH}$`));
  await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();

  await expect(recordsTable(page)).toBeVisible();
  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();
  await expect(dateRangeTrigger(page)).toBeVisible();

  // Seven inclusive organization-local dates.
  expect(spanInDays(await activeRange(page))).toBe(6);

  // Records offers search but no selection or column visibility.
  await expect(recordsSearch(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Columns" })).toHaveCount(0);
});

test("the Status filter sends canonical outcomes, newest first", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const attention = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Needs attention"),
  );
  expect(attention.get("outcome")).toBe("attention");
  expect(attention.get("sortBy")).toBe("entryAt");
  expect(attention.get("sortOrder")).toBe("desc");
  expect(attention.get("page")).toBe("1");

  const both = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Missed"),
  );
  expect(both.get("outcome")).toBe("attention,missed");
});

test("a facet combines with the status and sends ids, never labels", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Missed"),
  );
  const byForm = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Form", CLEANING_TASK),
  );

  expect(byForm.get("form")).toMatch(/^[0-9a-f-]{36}$/);
  expect(byForm.get("outcome")).toBe("missed");
});

test("only time sorts, and the day headings follow either order", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();
  await expect(page.locator('[data-slot="table-group-row"]').first()).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Check" }).getByRole("button"),
  ).toHaveCount(0);

  const byTime = await nextRecordsQuery(page, () =>
    page.getByRole("columnheader", { name: "Time" }).getByRole("button").click(),
  );
  expect(byTime.get("sortBy")).toBe("entryAt");
  await expect(page.locator('[data-slot="table-group-row"]').first()).toBeVisible();
});

test("search asks the server once typing settles", async ({ page }) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const searched = await nextRecordsQuery(page, () =>
    recordsSearch(page).fill(CLEANING_TASK),
  );
  expect(searched.get("search")).toBe(CLEANING_TASK);
  expect(searched.get("page")).toBe("1");
  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();
});

test("the date range blocks the future and applies a preset only on Apply", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  await openDateRange(page);
  // Tomorrow is unreachable: the picker disables it and the API rejects it anyway.
  await expect(page.locator("[data-disabled][data-day]").first()).toBeVisible();

  let requested = false;
  const listen = (request: Parameters<typeof isRecordsListRequest>[0]) => {
    if (isRecordsListRequest(request)) requested = true;
  };
  page.on("request", listen);
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.waitForTimeout(300);
  page.off("request", listen);
  expect(requested).toBe(false);

  const previousMonth = await nextRecordsQuery(page, () =>
    page.getByRole("button", { name: "Apply" }).click(),
  );
  expect(previousMonth.get("dateFrom")).toMatch(/^\d{4}-\d{2}-01$/);
  expect((await activeRange(page)).from).toBe(previousMonth.get("dateFrom"));
});

test("an empty filter says why and clears back to every check", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  // Nothing seeded is voided, so rows exist in range but none match.
  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Voided"),
  );

  await expect(
    page.getByText("No records match the selected filters"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).last().click();

  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();
});

test("a failed load offers a retry that recovers", async ({ page }) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  await page.route("**/locations/*/records?*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR", message: "boom" }),
    }),
  );

  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Missed"),
  );

  const error = page.getByTestId("data-table-error");
  await expect(error).toBeVisible();

  await page.unroute("**/locations/*/records?*");
  await page.getByTestId("data-table-retry").click();

  await expect(error).toBeHidden();
});

test("a record opens from the keyboard in a side sheet and steps to the next", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  // Scoped to a known row: what else is scheduled today varies between runs.
  const open = page
    .locator("tr", { hasText: CLEANING_TASK })
    .first()
    .getByRole("button", { name: /^View record:/ });
  await open.focus();
  await page.keyboard.press("Enter");

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(CLEANING_TASK).first()).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(sheet.getByText(/^\d+ of \d+$/)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("the print link carries the facets but no status, paging or sort", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Form", CLEANING_TASK),
  );
  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Needs attention"),
  );

  const href = await printHref(page);

  expect(href).toContain("/records/print?");
  expect(href).toMatch(/form=[0-9a-f-]{36}/);
  expect(href).not.toContain("outcome=");
  expect(href).not.toContain("page=");
  expect(href).not.toContain("sortBy=");
});

test("switching location never shows the previous location's rows", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();
  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();

  const annexRequest = page.waitForRequest(isRecordsListRequest);

  await page.getByRole("button", { name: "Location" }).click();
  await page
    .getByRole("menuitemradio", { name: `${E2E_PREFIX} Annex` })
    .click();
  await annexRequest;

  // The annex has no seeded work, so the main site's rows must be gone.
  await expect(page.getByText(CLEANING_TASK)).toHaveCount(0);
  await expect(page.getByText("Nothing recorded in this period")).toBeVisible();
});
