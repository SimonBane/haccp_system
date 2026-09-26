import { expect, test, type Page } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import {
  ensureSubmittedRecord,
  hasHorizontalOverflow,
  RECORDS_PATH,
  recordsTable,
} from "../../support/records.js";

const CLEANING_TASK = `${E2E_PREFIX} Clean prep surface`;
const REPORT_PATH = `${LOCALE_PREFIX}/records/print`;

type Tenant = { locations: { id: string; isDefault: boolean }[] };

async function defaultLocationId(page: Page): Promise<string> {
  const api = await apiContext(page);
  try {
    const tenant = await json<Tenant>(api, "get", "/tenant/current");
    return (tenant.locations.find((entry) => entry.isDefault) ??
      tenant.locations[0]!)!.id;
  } finally {
    await api.dispose();
  }
}

/** Base UI renders the action as an anchor with role="button", not a link. */
function reportLink(page: Page) {
  return page.getByRole("button", { name: "Print report" }).first();
}

/** The link the grid builds is the only supported entry point, so read the range from it. */
async function reportHref(page: Page): Promise<string> {
  return (await reportLink(page).getAttribute("href"))!;
}

function reportTable(page: Page) {
  return page.getByRole("table");
}

function recordRows(page: Page) {
  return page.locator("tbody[data-report-record]");
}

async function openReportFromRecords(page: Page): Promise<void> {
  await page.goto(await reportHref(page));
  await expect(
    page.getByRole("heading", { name: "Records report" }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await ensureSubmittedRecord(page, CLEANING_TASK);
});

test("the print action opens the report for the grid's current selection", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const params = new URL(await reportHref(page), "http://localhost")
    .searchParams;

  expect(params.get("locationId")).toBeTruthy();
  expect(params.get("dateFrom")).toBeTruthy();
  expect(params.get("dateTo")).toBeTruthy();
  expect(params.has("page")).toBe(false);
  expect(params.has("pageSize")).toBe(false);
  expect(params.has("sortBy")).toBe(false);
  expect(params.has("sortOrder")).toBe(false);

  const [report] = await Promise.all([
    page.waitForEvent("popup"),
    reportLink(page).click(),
  ]);

  await expect(
    report.getByRole("heading", { name: "Records report" }),
  ).toBeVisible();
  await expect(report.getByText(CLEANING_TASK).first()).toBeVisible();
});

test("the report carries a status filter chosen on Records", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const href = await reportHref(page);
  const locationId = new URL(href, "http://localhost").searchParams.get(
    "locationId",
  )!;
  const params = new URL(href, "http://localhost").searchParams;

  await page.goto(
    `${REPORT_PATH}?locationId=${locationId}&dateFrom=${params.get("dateFrom")}&dateTo=${params.get("dateTo")}&state=missed`,
  );

  await expect(
    page.getByRole("heading", { name: "Records report" }),
  ).toBeVisible();
  const states = await recordRows(page).evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.includes("Missed") ?? false),
  );
  expect(states.every(Boolean)).toBe(true);
});

test("the report shows no application chrome and no navigation", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await openReportFromRecords(page);

  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Records" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print report" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeVisible();
});

test("the report row count matches the Records total for the same filters", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await expect(recordsTable(page)).toBeVisible();

  const href = await reportHref(page);
  const params = new URL(href, "http://localhost").searchParams;
  const locationId = params.get("locationId")!;

  const api = await apiContext(page);
  const grid = await json<{ total: number }>(
    api,
    "get",
    `/locations/${locationId}/records?dateFrom=${params.get("dateFrom")}&dateTo=${params.get("dateTo")}&page=1&pageSize=100`,
  );
  await api.dispose();

  await page.goto(href);
  await expect(reportTable(page)).toBeVisible();
  await expect(recordRows(page)).toHaveCount(grid.total);
});

test("every reported occurrence appears exactly once, in a stable order", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  const href = await reportHref(page);

  const read = async () => {
    await page.goto(href);
    await expect(reportTable(page)).toBeVisible();
    return recordRows(page).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-occurrence-id")),
    );
  };

  const first = await read();
  const second = await read();

  expect(first).toEqual(second);
  expect(new Set(first).size).toBe(first.length);
});

test("an opened no-deadline occurrence prints as Open with no deadline content", async ({
  page,
}) => {
  const locationId = await defaultLocationId(page);
  const title = `E2E Report open no deadline ${Date.now()}`;

  const api = await apiContext(page);
  await json(api, "post", `/locations/${locationId}/task-templates`, {
    title,
    type: "cleaning",
    weekdays: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
    scheduledTimes: ["23:59"],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: null,
  });
  await api.dispose();

  await page.goto(RECORDS_PATH);
  await openReportFromRecords(page);

  const row = recordRows(page).filter({ hasText: title });
  await expect(row).toHaveCount(1);

  // "Open" only: no timing suffix, and no deadline or scheduling-window content.
  await expect(row).toContainText("Open");
  await expect(row).not.toContainText("late");
  await expect(row).not.toContainText("Deadline");
  await expect(row).not.toContainText("Available from");
});

test("a submitted record with no deadline prints as Done, never late", async ({
  page,
}) => {
  const locationId = await defaultLocationId(page);
  const title = `E2E Report submitted no deadline ${Date.now()}`;

  const api = await apiContext(page);
  await json(api, "post", `/locations/${locationId}/task-templates`, {
    title,
    type: "cleaning",
    weekdays: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
    scheduledTimes: ["23:59"],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: null,
  });
  await api.dispose();

  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  await ensureSubmittedRecord(page, title);

  await page.goto(RECORDS_PATH);
  await openReportFromRecords(page);

  const row = recordRows(page).filter({ hasText: title });
  await expect(row).toContainText("Done");
  await expect(row).not.toContainText("late");
});

test("a submitted row names its recorder on a single line", async ({
  page,
}) => {
  await page.goto(RECORDS_PATH);
  await openReportFromRecords(page);

  const row = recordRows(page).filter({ hasText: CLEANING_TASK }).first();

  await expect(row.getByRole("row")).toHaveCount(1);
  await expect(row.getByRole("cell").last()).not.toBeEmpty();
});

test("a future date in a crafted URL is refused without a table", async ({
  page,
}) => {
  const locationId = await defaultLocationId(page);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  await page.goto(
    `${REPORT_PATH}?locationId=${locationId}&dateFrom=${tomorrow}&dateTo=${tomorrow}`,
  );

  await expect(
    page.getByRole("heading", { name: "Invalid report request" }),
  ).toBeVisible();
  await expect(reportTable(page)).toHaveCount(0);
});

test("paging and sorting are refused in a crafted URL", async ({ page }) => {
  await page.goto(RECORDS_PATH);
  const href = await reportHref(page);

  await page.goto(`${href}&page=1&pageSize=25&sortBy=title`);

  await expect(
    page.getByRole("heading", { name: "Invalid report request" }),
  ).toBeVisible();
  await expect(reportTable(page)).toHaveCount(0);
});

test("a valid range with nothing eligible renders a complete zero-record report", async ({
  page,
}) => {
  const locationId = await defaultLocationId(page);

  await page.goto(
    `${REPORT_PATH}?locationId=${locationId}&dateFrom=2019-01-01&dateTo=2019-01-31`,
  );

  await expect(
    page.getByRole("heading", { name: "Records report" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No records in this period" }),
  ).toBeVisible();
  await expect(reportTable(page)).toHaveCount(0);
  await expect(page.getByText("Generated by SafeCheck")).toBeVisible();
});

test("a multi-month range is accepted", async ({ page }) => {
  const locationId = await defaultLocationId(page);
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const dateFrom = new Date(today.getTime() - 89 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  await page.goto(
    `${REPORT_PATH}?locationId=${locationId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  );

  await expect(
    page.getByRole("heading", { name: "Records report" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Report too large" }),
  ).toHaveCount(0);
});

test("the report stays navigable on a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(RECORDS_PATH);
  await openReportFromRecords(page);

  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to Records" }),
  ).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

/** Print emulation at an A4-width viewport: the phone viewport is not a print surface. */
test("print media hides the screen controls and does not overflow the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.goto(RECORDS_PATH);
  await openReportFromRecords(page);

  await page.emulateMedia({ media: "print" });

  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Back to Records" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Records report" }),
  ).toBeVisible();
  await expect(reportTable(page)).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
