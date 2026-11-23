import type { Page, Request } from "@playwright/test";
import { expect } from "@playwright/test";
import { apiContext, json } from "./api.js";
import { CLEANING_ANSWERS } from "./forms.js";
import { fetchTodayItems } from "./today.js";
import { todayItemForTask } from "./tasks.js";
import { LOCALE_PREFIX } from "./env.js";

export const RECORDS_PATH = `${LOCALE_PREFIX}/dashboard/records`;

/**
 * A submitted record is Records-eligible immediately, even before its due time, so
 * one API write gives the grid a deterministic row without waiting for a due slot.
 */
/** Only for tasks on a tick form: the record is a single required tick. Returns the record id. */
export async function ensureSubmittedRecord(
  page: Page,
  task: { title: string } | { taskId: string },
): Promise<string> {
  const api = await apiContext(page);

  try {
    const item =
      "taskId" in task
        ? await todayItemForTask(api, task.taskId)
        : (await fetchTodayItems(api)).find((entry) => entry.title === task.title);
    expect(item, `Today has no check for ${JSON.stringify(task)}`).toBeDefined();

    if (item!.recordState === "active" && item!.recordId) {
      return item!.recordId;
    }

    const tenant = await json<{
      locations: { id: string; isDefault: boolean }[];
    }>(api, "get", "/tenant/current");
    const location =
      tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;

    // An earlier journey may have voided this occurrence's record; POST would 409,
    // so a retained record is reactivated with PUT instead.
    const saved = await json<{ id: string }>(
      api,
      item!.recordId ? "put" : "post",
      item!.recordId
        ? `/locations/${location.id}/today/records/${item!.recordId}`
        : `/locations/${location.id}/today/occurrences/${item!.occurrenceId}/record`,
      { values: CLEANING_ANSWERS },
    );
    return saved.id;
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
