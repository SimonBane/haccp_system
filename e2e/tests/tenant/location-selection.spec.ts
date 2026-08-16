import { expect, test, type Page } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

const TODAY_REQUEST = /\/locations\/([0-9a-f-]{36})\/today/;

async function locationCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "haccp_location_id")?.value;
}

test("an admin lands on the dashboard and can switch location", async ({
  page,
}) => {
  // Collected rather than awaited in order: the first render is server-side, so
  // there is no guaranteed client Today request before the switch.
  const fetchedFor: string[] = [];
  page.on("response", (response) => {
    const id = TODAY_REQUEST.exec(response.url())?.[1];
    if (id && response.request().method() === "GET") fetchedFor.push(id);
  });

  await page.goto(`${LOCALE_PREFIX}/dashboard`);

  // Not /sign-in and not /no-organization: both are redirects the dashboard layout
  // performs, so the URL alone proves the session carries an org.
  await expect(page).toHaveURL(new RegExp(`${LOCALE_PREFIX}/dashboard`));

  await page.getByRole("button", { name: "Location" }).click();
  await page
    .getByRole("menuitemradio", { name: `${E2E_PREFIX} Annex` })
    .click();

  // Not HttpOnly by design, so the server render agrees with the client on reload.
  await expect.poll(() => locationCookie(page)).toBeTruthy();
  const annexId = await locationCookie(page);

  // The switch has to move the data too, not just the preference.
  await expect.poll(() => fetchedFor).toContain(annexId);
});
