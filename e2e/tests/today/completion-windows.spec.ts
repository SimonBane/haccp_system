import { zonedMinutesOfDay } from "@haccp/shared";
import { expect, test } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import { expandGroup, fetchTodayItems, occurrenceRow } from "../../support/today.js";

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

    const tenant = await json<Tenant>(api, "get", "/tenant/current");
    const location =
      tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
    const scheduledTime = nearFutureTime(tenant.organization.timezone, 15);
    const title = `E2E Unopened ${Date.now()}`;

    await json(api, "post", `/locations/${location.id}/task-templates`, {
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
      scheduledTimes: [scheduledTime],
      completionOpensBeforeMinutes: 0,
      completionDueAfterMinutes: 0,
    });

    const items = await fetchTodayItems(api);
    const item = items.find((entry) => entry.title === title);
    expect(item, `Today has no occurrence titled "${title}"`).toBeDefined();
    expect(item!.status).toBe("upcoming");
    await api.dispose();

    await page.reload();
    await expandGroup(page, scheduledTime);
    const target = occurrenceRow(page, item!.occurrenceId);
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

    const tenant = await json<Tenant>(api, "get", "/tenant/current");
    const location =
      tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
    const scheduledTime = nearFutureTime(tenant.organization.timezone, 20);
    const stamp = Date.now();
    const openTitle = `E2E Mixed open ${stamp}`;
    const closedTitle = `E2E Mixed closed ${stamp}`;
    const weekdays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    // Opens from the start of the day — already available despite the future scheduled time.
    await json(api, "post", `/locations/${location.id}/task-templates`, {
      title: openTitle,
      type: "cleaning",
      weekdays,
      scheduledTimes: [scheduledTime],
      completionOpensBeforeMinutes: 1440,
      completionDueAfterMinutes: 0,
    });

    // Opens exactly at the scheduled time — still closed right now.
    await json(api, "post", `/locations/${location.id}/task-templates`, {
      title: closedTitle,
      type: "cleaning",
      weekdays,
      scheduledTimes: [scheduledTime],
      completionOpensBeforeMinutes: 0,
      completionDueAfterMinutes: 0,
    });

    const items = await fetchTodayItems(api);
    const openItem = items.find((entry) => entry.title === openTitle);
    const closedItem = items.find((entry) => entry.title === closedTitle);
    expect(openItem, `Today has no occurrence titled "${openTitle}"`).toBeDefined();
    expect(closedItem, `Today has no occurrence titled "${closedTitle}"`).toBeDefined();
    expect(openItem!.status).toBe("pending");
    expect(closedItem!.status).toBe("upcoming");
    await api.dispose();

    await page.reload();
    await expandGroup(page, scheduledTime);

    const openRow = occurrenceRow(page, openItem!.occurrenceId);
    const closedRow = occurrenceRow(page, closedItem!.occurrenceId);
    await expect(openRow).toBeVisible();
    await expect(closedRow).toBeVisible();

    await expect(openRow.getByTestId("today-task-activate")).toBeEnabled();
    await expect(closedRow.getByTestId("today-task-activate")).toBeDisabled();
    await expect(closedRow).toContainText(/Available at/);
  });
});
