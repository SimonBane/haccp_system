import { expect, test } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import { RECORDS_PATH } from "../../support/records.js";

type Tenant = {
  locations: { id: string; isDefault: boolean }[];
};

/**
 * HACCP-70: Open · no deadline must render correctly on the mobile card list too, not
 * only the desktop table.
 */
test("an opened, unrecorded Never-overdue occurrence shows as Open with No deadline timing on a phone", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  const api = await apiContext(page);

  const tenant = await json<Tenant>(api, "get", "/tenant/current");
  const location =
    tenant.locations.find((entry) => entry.isDefault) ?? tenant.locations[0]!;
  const title = `E2E Mobile open ${Date.now()}`;

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
    scheduledTimes: ["23:59"],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: null,
  });
  await api.dispose();

  await page.goto(RECORDS_PATH);
  const card = page.getByTestId("data-table-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByText("Open", { exact: true })).toBeVisible();
  await expect(card.getByText("No deadline", { exact: true })).toBeVisible();
});
