import { test as setup, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { apiContext, json } from "../../support/api.js";
import {
  E2E_PREFIX,
  LOCALE_PREFIX,
  storageStatePath,
} from "../../support/env.js";

setup.use({ storageState: storageStatePath("admin") });

/** Journey 5 pages at 10, so 11 is the smallest count that proves page 2 is reachable. */
const EQUIPMENT_COUNT = 11;

type Location = { id: string; name: string; isDefault: boolean };
type Tenant = {
  organization: { id: string; multipleLocationsEnabled: boolean };
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

async function replaceE2eRows(
  api: APIRequestContext,
  path: string,
  label: (row: Named) => string,
) {
  const { items } = await json<{ items: Named[] }>(api, "get", path);

  for (const row of items) {
    if (label(row).startsWith(E2E_PREFIX)) {
      await json(api, "delete", `${path}/${row.id}`);
    }
  }
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

  // Templates reference equipment, so they must go first or the delete is rejected.
  await replaceE2eRows(api, templatePath, (row) => row.title ?? "");
  await replaceE2eRows(api, equipmentPath, (row) => row.name ?? "");

  const fridges: Named[] = [];
  for (let index = 1; index <= EQUIPMENT_COUNT; index += 1) {
    fridges.push(
      await json<Named>(api, "post", equipmentPath, {
        // Zero-padded so the 11th row is identifiable by name, not by position.
        name: `${E2E_PREFIX} Fridge ${String(index).padStart(2, "0")}`,
        type: "fridge",
        minTempC: 0,
        maxTempC: 4,
      }),
    );
  }

  await json(api, "post", templatePath, {
    title: `${E2E_PREFIX} Fridge check`,
    type: "temperature",
    weekdays: ALL_WEEKDAYS,
    scheduledTimes: ["08:00"],
    equipmentId: fridges[0]!.id,
  });

  await json(api, "post", templatePath, {
    title: `${E2E_PREFIX} Clean prep surface`,
    type: "cleaning",
    weekdays: ALL_WEEKDAYS,
    scheduledTimes: ["09:00"],
  });

  const seeded = await json<{ items: Named[] }>(api, "get", equipmentPath);
  expect(
    seeded.items.filter((row) => (row.name ?? "").startsWith(E2E_PREFIX))
      .length,
  ).toBe(EQUIPMENT_COUNT);

  await api.dispose();
});
