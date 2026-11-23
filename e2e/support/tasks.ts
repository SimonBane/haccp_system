import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { json } from "./api.js";
import { fetchTodayItems, type ScheduledTodayItem } from "./today.js";

export const EVERY_DAY = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** A task a journey makes for itself, every day unless the body says otherwise; returns its id. */
export async function createTask(
  api: APIRequestContext,
  locationId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const created = await json<{ id: string }>(
    api,
    "post",
    `/locations/${locationId}/task-templates`,
    { weekdays: EVERY_DAY, ...body },
  );
  return created.id;
}

/** Tasks on one form share its name, so a journey finds its own check by task id. */
export async function todayItemForTask(
  api: APIRequestContext,
  taskId: string,
): Promise<ScheduledTodayItem> {
  const item = (await fetchTodayItems(api)).find(
    (entry) => entry.templateId === taskId,
  );
  expect(item, `Today has no check for task ${taskId}`).toBeDefined();
  return item!;
}

/** A table row or mobile card by its row id. */
export function rowByKey(page: Page, key: string) {
  return page.locator(`[data-row-key="${key}"]`);
}
