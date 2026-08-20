import {
  pickDefaultLocation,
  tenantContextResponseSchema,
  todayResponseSchema,
  zonedDateString,
  zonedMinutesOfDay,
  type TodayTaskItem,
} from "@haccp/shared";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { apiContext, json } from "./api.js";

const MINUTES_PER_DAY = 24 * 60;

function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Two HH:mm slots still due today. Template create skips same-day occurrences
 * whose dueAt is already past createdAt, so 08:00/09:00 vanish after morning.
 */
export function upcomingSameDayTimes(
  timeZone: string,
  now = new Date(),
): [string, string] {
  const current = zonedMinutesOfDay(now, timeZone);
  const lastMinute = MINUTES_PER_DAY - 1;
  const first = Math.min(current + 2, lastMinute);
  const second = Math.min(current + 3, lastMinute);

  if (first <= current) {
    throw new Error(
      `Cannot seed same-day Today occurrences: local time in ${timeZone} is ${formatClock(current)}. Reconciliation skips slots whose dueAt is already past template.createdAt.`,
    );
  }

  return [formatClock(first), formatClock(second)];
}

function flattenTodayItems(response: {
  sections: {
    morning: TodayTaskItem[];
    afternoon: TodayTaskItem[];
    evening: TodayTaskItem[];
  };
}): TodayTaskItem[] {
  return [
    ...response.sections.morning,
    ...response.sections.afternoon,
    ...response.sections.evening,
  ];
}

/** Locate Today's stored occurrences — never reconstruct template/date/time identities. */
export async function fetchTodayItems(
  api: APIRequestContext,
): Promise<TodayTaskItem[]> {
  const tenant = tenantContextResponseSchema.parse(
    await json(api, "get", "/tenant/current"),
  );
  const location = pickDefaultLocation(tenant.locations);
  const date = zonedDateString(new Date(), tenant.organization.timezone);
  const today = todayResponseSchema.parse(
    await json(
      api,
      "get",
      `/locations/${location.id}/today?date=${date}`,
    ),
  );
  return flattenTodayItems(today);
}

export async function findTodayItem(
  page: Page,
  title: string,
): Promise<TodayTaskItem> {
  const api = await apiContext(page);
  try {
    const items = await fetchTodayItems(api);
    const item = items.find((entry) => entry.title === title);
    if (!item) {
      throw new Error(`Today has no occurrence titled "${title}"`);
    }
    return item;
  } finally {
    await api.dispose();
  }
}

/** The row card carries the state; the stretched overlay button is the click target. */
export function row(page: Page, title: string) {
  return page.getByTestId("today-task-row").filter({ hasText: title }).first();
}

/**
 * A fully completed time group collapses, so a row a prior journey completed is
 * absent from the DOM rather than present-and-completed. Reopen it before asserting.
 */
export async function expandGroup(page: Page, scheduledTime: string) {
  const group = page
    .getByTestId("today-time-group")
    .filter({ has: page.locator(`[data-scheduled-time="${scheduledTime}"]`) })
    .or(page.locator(`[data-scheduled-time="${scheduledTime}"]`))
    .first();

  await expect(group).toBeVisible();

  if ((await group.getByTestId("today-task-row").count()) === 0) {
    await group.getByTestId("today-time-group-toggle").first().click();
  }
}

/**
 * The suite runs single-worker against one seeded org (`playwright.config.ts`:
 * `workers: 1`), so completion.spec.ts's two tests leave both seeded occurrences
 * completed by the time later specs run. Undo first so a test that needs a
 * pending row isn't at the mercy of file execution order.
 */
export async function ensurePending(
  page: Page,
  title: string,
): Promise<TodayTaskItem> {
  const item = await findTodayItem(page, title);
  await expandGroup(page, item.scheduledTime);
  const target = row(page, title);
  await expect(target).toBeVisible();

  if ((await target.getAttribute("data-completed")) === "true") {
    await target.getByTestId("today-task-activate").click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(target).not.toHaveAttribute("data-completed", "true");
  }

  return item;
}
