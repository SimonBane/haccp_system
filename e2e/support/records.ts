import type { Page, Request } from "@playwright/test";
import { expect } from "@playwright/test";
import { apiContext, json } from "./api.js";
import { fetchTodayItems } from "./today.js";
import { LOCALE_PREFIX } from "./env.js";

export const RECORDS_PATH = `${LOCALE_PREFIX}/dashboard/records`;

/**
 * A submitted record is Records-eligible immediately, even before its due time, so
 * one API write gives the grid a deterministic row without waiting for a due slot.
 */
export async function ensureSubmittedRecord(
  page: Page,
  title: string,
): Promise<void> {
  const api = await apiContext(page);

  try {
    const items = await fetchTodayItems(api);
    const item = items.find((entry) => entry.title === title);
    expect(item, `Today has no occurrence titled "${title}"`).toBeDefined();

    if (item!.recordState === "active") {
      return;
    }

    const tenant = await json<{
      locations: { id: string; isDefault: boolean }[];
    }>(api, "get", "/tenant/current");
    const location =
      tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;

    // An earlier journey may have voided this occurrence's record; POST would 409,
    // so a retained record is reactivated with PUT instead.
    await json(
      api,
      item!.recordState === "voided" ? "put" : "post",
      `/locations/${location.id}/today/occurrences/${item!.occurrenceId}/record`,
      { kind: "ordinary" },
    );
  } finally {
    await api.dispose();
  }
}

export function isRecordsListRequest(request: Request): boolean {
  return (
    request.method() === "GET" &&
    /\/locations\/[^/]+\/records\?/.test(request.url())
  );
}

/** Query parameters of the next Records list request the page issues. */
export async function nextRecordsQuery(
  page: Page,
  action: () => Promise<void>,
): Promise<URLSearchParams> {
  const [request] = await Promise.all([
    page.waitForRequest(isRecordsListRequest),
    action(),
  ]);

  return new URL(request.url()).searchParams;
}

export function recordsTable(page: Page) {
  return page.getByRole("table");
}

export function dateRangeTrigger(page: Page) {
  return page.getByRole("button", { name: "Date range" });
}

export async function openDateRange(page: Page): Promise<void> {
  await dateRangeTrigger(page).click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
}

/** The header's sort control is named by its aria-label, not by the column title. */
export function sortHeader(page: Page, column: string) {
  return page
    .getByRole("columnheader")
    .filter({ hasText: column })
    .getByRole("button");
}

export function filterTrigger(page: Page, name: string) {
  return page.getByRole("button", { name: `Filter by ${name}` });
}

/** Opens a filter popover, toggles one option by its translated label, and closes it. */
export async function toggleFilterOption(
  page: Page,
  filter: string,
  option: string,
): Promise<void> {
  await filterTrigger(page, filter).click();
  await page.getByRole("checkbox", { name: option }).click();
  await page.keyboard.press("Escape");
}

type DocumentGlobal = {
  document: { documentElement: { scrollWidth: number; clientWidth: number } };
};

/** The e2e tsconfig has no DOM lib, so the page globals are narrowed by hand. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const { document } = globalThis as unknown as DocumentGlobal;
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
    );
  });
}
