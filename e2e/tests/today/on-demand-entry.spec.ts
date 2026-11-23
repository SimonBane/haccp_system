import {
  pickDefaultLocation,
  recordsListResponseSchema,
  tenantContextResponseSchema,
  zonedDateString,
} from "@haccp/shared";
import { expect, test } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import { LOCALE_PREFIX } from "../../support/env.js";
import { ON_DEMAND_FORM_NAME } from "../../support/forms.js";

test("logs an on-demand entry from Today and files it in Records", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);

  await page.getByTestId("log-entry").click();
  const panel = page.getByTestId("log-entry-panel");
  await panel.getByRole("button", { name: new RegExp(ON_DEMAND_FORM_NAME) }).click();
  await panel.getByLabel("Cleaned").check();

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/today\/forms\/[^/]+\/records$/.test(response.url()),
  );
  await panel.getByTestId("record-save").click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { id: recordId } = (await response.json()) as { id: string };

  await expect(
    page.locator(
      `[data-testid="today-task-row"][data-row-key="${recordId}"]`,
    ),
  ).toBeVisible();

  const api = await apiContext(page);
  try {
    const tenant = tenantContextResponseSchema.parse(
      await json(api, "get", "/tenant/current"),
    );
    const location = pickDefaultLocation(tenant.locations);
    const today = zonedDateString(new Date(), tenant.organization.timezone);
    const records = recordsListResponseSchema.parse(
      await json(
        api,
        "get",
        `/locations/${location.id}/records?dateFrom=${today}&dateTo=${today}&pageSize=100`,
      ),
    );
    expect(records.items.find((item) => item.id === recordId)).toMatchObject({
      kind: "on_demand",
      taskTemplateId: null,
    });

    // Leave the day as it was for journeys that count Today's rows.
    await json(
      api,
      "delete",
      `/locations/${location.id}/today/records/${recordId}`,
    );
  } finally {
    await api.dispose();
  }
});
