import { expect, test, type Page } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import {
  dateRangeTrigger,
  ensureSubmittedRecord,
  filterTrigger,
  isRecordsListRequest,
  nextRecordsQuery,
  openDateRange,
  RECORDS_PATH,
  recordsTable,
  sortHeader,
  toggleFilterOption,
} from "../../support/records.js";

const CLEANING_TASK = `${E2E_PREFIX} Clean prep surface`;

/**
 * The server render answers the default request and the controller seeds it, so the
 * first page costs no client fetch. That makes the print link — built from the same
 * local state — the way to read the active range without forcing a request.
 */
async function activeRange(page: Page): Promise<{ from: string; to: string }> {
  const href = await page
    .getByRole("link", { name: "Print report" })
    .getAttribute("href");
  const params = new URL(href!, "http://localhost").searchParams;

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
  await ensureSubmittedRecord(page, CLEANING_TASK);
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

  // Records offers no free-text search, selection or column visibility.
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Select all" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Columns" })).toHaveCount(0);
});

test("rows-per-page is answered by the server and returns to page one", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const resized = await nextRecordsQuery(page, async () => {
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "10", exact: true }).click();
  });

  expect(resized.get("pageSize")).toBe("10");
  expect(resized.get("page")).toBe("1");
  expect(resized.get("sortBy")).toBe("scheduledAt");
  expect(resized.get("sortOrder")).toBe("asc");
  expect(resized.get("search")).toBeNull();
  expect(resized.get("dateFrom")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(resized.get("dateTo")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("sortable headers ask the server for the allowlisted sort keys", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const byDate = await nextRecordsQuery(page, () =>
    sortHeader(page, "Date/time").click(),
  );
  expect(byDate.get("sortBy")).toBe("scheduledAt");
  expect(byDate.get("sortOrder")).toBe("desc");

  const byTitle = await nextRecordsQuery(page, () =>
    sortHeader(page, "Task/monitoring point").click(),
  );
  expect(byTitle.get("sortBy")).toBe("title");
  expect(byTitle.get("sortOrder")).toBe("asc");

  // Status, Reading and Outcome are presentation only in this task.
  for (const column of ["Status", "Reading", "Outcome"]) {
    await expect(sortHeader(page, column)).toHaveCount(0);
  }
});

test("Type and Status filters send canonical values, never translated labels", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const byType = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Type", "Cleaning"),
  );
  expect(byType.get("type")).toBe("cleaning");
  expect(byType.get("page")).toBe("1");

  const byStatus = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Submitted"),
  );
  expect(byStatus.get("type")).toBe("cleaning");
  expect(byStatus.get("state")).toBe("submitted");

  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();
});

test("the temperature-result filter appears only for a pure temperature selection", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const resultFilter = filterTrigger(page, "Temperature result");
  await expect(resultFilter).toHaveCount(0);

  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Type", "Temperature"),
  );
  await expect(resultFilter).toBeVisible();

  const withResult = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Temperature result", "Within range"),
  );
  expect(withResult.get("result")).toBe("pass");

  // Widening Type past temperature hides the control and drops the outcome filter.
  const widened = await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Type", "Cleaning"),
  );
  expect(widened.get("type")).toBe("cleaning,temperature");
  expect(widened.get("result")).toBeNull();
  await expect(resultFilter).toHaveCount(0);
});

test("the date range blocks the future and accepts a multi-month span", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  await openDateRange(page);
  // Tomorrow is unreachable: the picker disables it and the API rejects it anyway.
  await expect(page.locator("[data-disabled][data-day]").first()).toBeVisible();
  await page.keyboard.press("Escape");

  const longRange = await nextRecordsQuery(page, async () => {
    await openDateRange(page);
    await page.getByRole("button", { name: "Last 60 days" }).click();
  });

  expect(longRange.get("page")).toBe("1");
  expect(
    spanInDays({
      from: longRange.get("dateFrom")!,
      to: longRange.get("dateTo")!,
    }),
  ).toBe(59);

  await expect(page.getByTestId("records-metadata")).toBeVisible();
  expect(spanInDays(await activeRange(page))).toBe(59);
});

test("the metadata line and empty states distinguish no work from no matches", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const metadata = page.getByTestId("records-metadata");
  await expect(metadata).toBeVisible();
  await expect(metadata).toContainText(/\d+/);

  // Nothing seeded is voided, so rows exist in range but none match.
  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Voided"),
  );

  const clearFilters = page.getByRole("button", { name: "Clear filters" });
  await expect(clearFilters).toBeVisible();
  await expect(page.getByText(CLEANING_TASK)).toHaveCount(0);

  // No request assertion here: clearing returns to the default query key, which the
  // query client may still serve from cache within its stale window.
  await clearFilters.click();

  await expect(clearFilters).toBeHidden();
  await expect(page.getByText(CLEANING_TASK).first()).toBeVisible();
  // Clearing filters never clears the required date scope.
  await expect(dateRangeTrigger(page)).toBeVisible();
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
    toggleFilterOption(page, "Type", "Cleaning"),
  );

  const error = page.getByTestId("data-table-error");
  await expect(error).toBeVisible();

  await page.unroute("**/locations/*/records?*");
  await page.getByTestId("data-table-retry").click();

  await expect(error).toBeHidden();
  await expect(recordsTable(page)).toBeVisible();
});

/**
 * Only the keyboard path and the rendered content are asserted here. Closing on a
 * dataset change is not: on desktop the detail is a modal `Dialog`, so a click aimed
 * at a filter, sort header or pager is consumed dismissing the overlay and never
 * reaches the control — the same limitation `today/date-navigation.spec.ts` records.
 * The rule itself is a derived comparison (`recordsDatasetKey`) covered by
 * `records-composition.test.ts`.
 */
test("a row detail opens from the keyboard and shows the stored record", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  // Scoped to a known row: what else is scheduled today, and how many times the
  // seed has advanced the template, both vary between runs.
  const viewDetails = page
    .locator("tr", { hasText: CLEANING_TASK })
    .first()
    .getByRole("button", { name: "View details" });
  await viewDetails.focus();
  await expect(viewDetails).toBeFocused();
  await page.keyboard.press("Enter");

  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  await expect(detail.getByText(CLEANING_TASK).first()).toBeVisible();
  await expect(detail.getByText("Submitted").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
});

test("the print action carries the current filters but no paging or sort", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Type", "Cleaning"),
  );
  await nextRecordsQuery(page, () =>
    toggleFilterOption(page, "Status", "Submitted"),
  );
  await nextRecordsQuery(page, () =>
    sortHeader(page, "Task/monitoring point").click(),
  );

  const href = await page
    .getByRole("link", { name: "Print report" })
    .getAttribute("href");

  expect(href).toContain("/records/print?");
  expect(href).toContain("type=cleaning");
  expect(href).toContain("state=submitted");
  expect(href).toMatch(/dateFrom=\d{4}-\d{2}-\d{2}/);
  expect(href).toMatch(/dateTo=\d{4}-\d{2}-\d{2}/);
  expect(href).not.toContain("page=");
  expect(href).not.toContain("pageSize=");
  expect(href).not.toContain("sortBy=");
  expect(href).not.toContain("pending");
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
  await expect(page.getByTestId("records-metadata")).toBeVisible();
});
