import { test as setup, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import {
  CLEANING_FORM_NAME,
  FRIDGE_FORM_NAME,
  SCRATCH_READING_FORM_NAME,
  SCRATCH_TICK_FORM_NAME,
  ensureE2eForms,
} from "../../support/forms.js";
import {
  E2E_PREFIX,
  LOCALE_PREFIX,
  storageStatePath,
} from "../../support/env.js";
import { fetchTodayItems, upcomingSameDayTimes } from "../../support/today.js";

setup.use({ storageState: storageStatePath("admin") });

/** Journey 5 pages at 10, so 11 is the smallest count that proves page 2 is reachable. */
const TARGET_COUNT = 11;

type Location = { id: string; name: string; isDefault: boolean };
type Tenant = {
  organization: {
    id: string;
    multipleLocationsEnabled: boolean;
    timezone: string;
  };
  locations: Location[];
};
type Named = { id: string; name?: string; formName?: string };

const ALL_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Task-template DELETE archives rather than removes the row (HACCP-11), which would
 * leave an unremovable FK on its targets forever. So seeding never deletes — it
 * finds each fixture row by name and PATCHes it back to canonical values,
 * creating it only the first time. Nothing accumulates across runs.
 */
async function upsertByLabel(
  api: APIRequestContext,
  path: string,
  label: (row: Named) => string,
  target: string,
  payload: Record<string, unknown>,
): Promise<Named> {
  const { items } = await json<{ items: Named[] }>(api, "get", path);
  const existing = items.find((row) => label(row) === target);

  if (existing) {
    return await json<Named>(api, "patch", `${path}/${existing.id}`, payload);
  }

  return await json<Named>(api, "post", path, payload);
}

setup("seed locations, forms, equipment and templates", async ({ page }) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);
  const api = await apiContext(page);

  // The location switcher only renders with multipleLocationsEnabled and >1 location.
  const tenant = await json<Tenant>(api, "get", "/tenant/current");
  if (!tenant.organization.multipleLocationsEnabled) {
    await json(api, "patch", "/organizations/current", {
      multipleLocationsEnabled: true,
    });
  }

  const annexName = `${E2E_PREFIX} Annex`;
  let annex = tenant.locations.find((location) => location.name === annexName);
  if (!annex) {
    annex = await json<Location>(api, "post", "/locations", {
      name: annexName,
    });
  }

  const main =
    tenant.locations.find((location) => location.isDefault) ??
    tenant.locations[0]!;

  const targetsPath = `/locations/${main.id}/targets`;
  const templatePath = `/locations/${main.id}/task-templates`;

  const forms = await ensureE2eForms(api);

  // Journeys make their own tasks on the scratch forms; archive the last run's before they pile up.
  const scratchForms = new Set([SCRATCH_TICK_FORM_NAME, SCRATCH_READING_FORM_NAME]);
  const { items: tasks } = await json<{ items: Named[] }>(api, "get", templatePath);
  for (const task of tasks.filter((row) => scratchForms.has(row.formName ?? ""))) {
    await json(api, "delete", `${templatePath}/${task.id}`);
  }

  const fridges: Named[] = [];
  for (let index = 1; index <= TARGET_COUNT; index += 1) {
    // Zero-padded so the 11th row is identifiable by name, not by position.
    const name = `${E2E_PREFIX} Fridge ${String(index).padStart(2, "0")}`;
    fridges.push(
      await upsertByLabel(api, targetsPath, (row) => row.name ?? "", name, {
        name,
        kind: "equipment",
      }),
    );
  }

  const [fridgeTime, cleaningTime] = upcomingSameDayTimes(
    tenant.organization.timezone,
  );

  // Scheduled times must stay just ahead of "now", so this is a PATCH every run, not create-once.
  await upsertByLabel(
    api,
    templatePath,
    (row) => row.formName ?? "",
    FRIDGE_FORM_NAME,
    {
      formId: forms.fridgeReading,
      weekdays: ALL_WEEKDAYS,
      scheduledTimes: [fridgeTime],
      targets: [{ targetId: fridges[0]!.id }],
    },
  );

  await upsertByLabel(
    api,
    templatePath,
    (row) => row.formName ?? "",
    CLEANING_FORM_NAME,
    {
      formId: forms.cleaning,
      weekdays: ALL_WEEKDAYS,
      scheduledTimes: [cleaningTime],
    },
  );

  const seeded = await json<{ items: Named[] }>(api, "get", targetsPath);
  expect(
    seeded.items.filter((row) => (row.name ?? "").startsWith(E2E_PREFIX))
      .length,
  ).toBe(TARGET_COUNT);

  const todayTitles = (await fetchTodayItems(api)).map((item) => item.title);
  expect(todayTitles).toContain(FRIDGE_FORM_NAME);
  expect(todayTitles).toContain(CLEANING_FORM_NAME);

  await api.dispose();
});
