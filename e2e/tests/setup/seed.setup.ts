import { test as setup, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import {
  E2E_PREFIX,
  LOCALE_PREFIX,
  storageStatePath,
} from "../../support/env.js";
import {
  fetchTodayItems,
  upcomingSameDayTimes,
} from "../../support/today.js";

setup.use({ storageState: storageStatePath("admin") });

/** Journey 5 pages at 10, so 11 is the smallest count that proves page 2 is reachable. */
const EQUIPMENT_COUNT = 11;

type Location = { id: string; name: string; isDefault: boolean };
type Tenant = {
  organization: {
    id: string;
    multipleLocationsEnabled: boolean;
    timezone: string;
  };
  locations: Location[];
};
type Named = { id: string; name?: string; title?: string };

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
 * leave an unremovable FK on its equipment forever. So seeding never deletes — it
 * finds each fixture row by name/title and PATCHes it back to canonical values,
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

setup("seed locations, equipment and templates", async ({ page }) => {
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

  const equipmentPath = `/locations/${main.id}/equipment`;
  const templatePath = `/locations/${main.id}/task-templates`;

  const fridges: Named[] = [];
  for (let index = 1; index <= EQUIPMENT_COUNT; index += 1) {
    // Zero-padded so the 11th row is identifiable by name, not by position.
    const name = `${E2E_PREFIX} Fridge ${String(index).padStart(2, "0")}`;
    fridges.push(
      await upsertByLabel(api, equipmentPath, (row) => row.name ?? "", name, {
        name,
        type: "fridge",
        minTempC: 0,
        maxTempC: 4,
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
    (row) => row.title ?? "",
    `${E2E_PREFIX} Fridge check`,
    {
      title: `${E2E_PREFIX} Fridge check`,
      type: "temperature",
      weekdays: ALL_WEEKDAYS,
      scheduledTimes: [fridgeTime],
      equipmentId: fridges[0]!.id,
    },
  );

  await upsertByLabel(
    api,
    templatePath,
    (row) => row.title ?? "",
    `${E2E_PREFIX} Clean prep surface`,
    {
      title: `${E2E_PREFIX} Clean prep surface`,
      type: "cleaning",
      weekdays: ALL_WEEKDAYS,
      scheduledTimes: [cleaningTime],
    },
  );

  const seeded = await json<{ items: Named[] }>(api, "get", equipmentPath);
  expect(
    seeded.items.filter((row) => (row.name ?? "").startsWith(E2E_PREFIX))
      .length,
  ).toBe(EQUIPMENT_COUNT);

  const todayTitles = (await fetchTodayItems(api)).map((item) => item.title);
  expect(todayTitles).toContain(`${E2E_PREFIX} Fridge check`);
  expect(todayTitles).toContain(`${E2E_PREFIX} Clean prep surface`);

  await api.dispose();
});
