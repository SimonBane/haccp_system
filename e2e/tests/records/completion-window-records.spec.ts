import { expect, test } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { ensureE2eForms } from "../../support/forms.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import { RECORDS_PATH } from "../../support/records.js";
import { createTask, rowByKey, todayItemForTask } from "../../support/tasks.js";

type Tenant = {
  locations: { id: string; isDefault: boolean }[];
};

/**
 * HACCP-70: an opened, unrecorded Never-overdue occurrence reads as Open · no deadline
 * in Records, with availability/deadline detail — not blank, and not Missed.
 */
test("an opened, unrecorded Never-overdue occurrence shows as Open with No deadline timing", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  const api = await apiContext(page);
  const forms = await ensureE2eForms(api);

  const tenant = await json<Tenant>(api, "get", "/tenant/current");
  const location =
    tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
  const taskId = await createTask(api, location.id, {
    formId: forms.scratchTick,
    // A future scheduled time with the default (start-of-day) opening window is
    // already available now; a null deadline never becomes Missed.
    scheduledTimes: ["23:59"],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: null,
  });
  const { occurrenceId } = await todayItemForTask(api, taskId);
  await api.dispose();

  await page.goto(RECORDS_PATH);
  const row = rowByKey(page, occurrenceId);
  await expect(row).toBeVisible();
  await expect(row.getByText("Open", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: /^View record:/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Not recorded yet.")).toBeVisible();
  // No deadline, so the schedule names none and nothing ever closes it as missed.
  await expect(sheet.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Closed as missed")).toHaveCount(0);
});
