import { expect, test } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import { RECORDS_PATH } from "../../support/records.js";

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

  const tenant = await json<Tenant>(api, "get", "/tenant/current");
  const location =
    tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
  const title = `E2E Open no deadline ${Date.now()}`;

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
    // A future scheduled time with the default (start-of-day) opening window is
    // already available now; a null deadline never becomes Missed.
    scheduledTimes: ["23:59"],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: null,
  });
  await api.dispose();

  await page.goto(RECORDS_PATH);
  const row = page.getByRole("button").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText("Open", { exact: true })).toBeVisible();
  await expect(row.getByText("No deadline", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "View details" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("No deadline — never overdue")).toBeVisible();
});
