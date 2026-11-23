import { zonedMinutesOfDay } from "@haccp/shared";
import { expect, test } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { ensureE2eForms } from "../../support/forms.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import { createTask, todayItemForTask } from "../../support/tasks.js";
import { expandGroup, occurrenceRow } from "../../support/today.js";

const MINUTES_PER_DAY = 24 * 60;

function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** A single HH:mm slot far enough ahead that a 0-minute opening window is still closed. */
function nearFutureTime(timeZone: string, aheadMinutes: number): string {
  const target = (zonedMinutesOfDay(new Date(), timeZone) + aheadMinutes) % MINUTES_PER_DAY;
  return formatClock(target);
}

type Tenant = {
  organization: { timezone: string };
  locations: { id: string; isDefault: boolean }[];
};

/**
 * HACCP-70: each Today row enables and styles from its own occurrence window — not a
 * blanket future-date rule, and not the group's shared scheduledTime.
 */
test.describe("Today — per-occurrence completion windows", () => {
  test("an unopened row cannot be activated, and shows when it opens", async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
    const api = await apiContext(page);
    const forms = await ensureE2eForms(api);

    const tenant = await json<Tenant>(api, "get", "/tenant/current");
    const location =
      tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
    const scheduledTime = nearFutureTime(tenant.organization.timezone, 15);
    const taskId = await createTask(api, location.id, {
      formId: forms.scratchTick,
      scheduledTimes: [scheduledTime],
      completionOpensBeforeMinutes: 0,
      completionDueAfterMinutes: 0,
    });

    const item = await todayItemForTask(api, taskId);
    expect(item.status).toBe("upcoming");
    await api.dispose();

    await page.reload();
    await expandGroup(page, scheduledTime);
    const target = occurrenceRow(page, item.occurrenceId);
    await expect(target).toBeVisible();
    await expect(target).toContainText(/Available at/);

    const button = target.getByTestId("today-task-activate");
    await expect(button).toBeDisabled();
  });

  test("mixed windows sharing one scheduled time: only the opened row is clickable", async ({
    page,
  }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
    const api = await apiContext(page);
    const forms = await ensureE2eForms(api);

    const tenant = await json<Tenant>(api, "get", "/tenant/current");
    const location =
      tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
    const scheduledTime = nearFutureTime(tenant.organization.timezone, 20);
    // Opens from the start of the day — already available despite the future scheduled time.
    const openTaskId = await createTask(api, location.id, {
      formId: forms.scratchTick,
      scheduledTimes: [scheduledTime],
      completionOpensBeforeMinutes: 1440,
      completionDueAfterMinutes: 0,
    });

    // Opens exactly at the scheduled time — still closed right now.
    const closedTaskId = await createTask(api, location.id, {
      formId: forms.scratchTick,
      scheduledTimes: [scheduledTime],
      completionOpensBeforeMinutes: 0,
      completionDueAfterMinutes: 0,
    });

    const openItem = await todayItemForTask(api, openTaskId);
    const closedItem = await todayItemForTask(api, closedTaskId);
    expect(openItem.status).toBe("pending");
    expect(closedItem.status).toBe("upcoming");
    await api.dispose();

    await page.reload();
    await expandGroup(page, scheduledTime);

    const openRow = occurrenceRow(page, openItem.occurrenceId);
    const closedRow = occurrenceRow(page, closedItem.occurrenceId);
    await expect(openRow).toBeVisible();
    await expect(closedRow).toBeVisible();

    await expect(openRow.getByTestId("today-task-activate")).toBeEnabled();
    await expect(closedRow.getByTestId("today-task-activate")).toBeDisabled();
    await expect(closedRow).toContainText(/Available at/);
  });
});
