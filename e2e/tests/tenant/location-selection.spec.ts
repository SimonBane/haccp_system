import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

test("an admin lands on the dashboard and can switch location", async ({
  page,
}) => {
  await page.goto(`${LOCALE_PREFIX}/dashboard`);

  // Not /sign-in and not /no-organization: both are redirects the dashboard
  // layout performs, so the URL alone proves the session carries an org.
  await expect(page).toHaveURL(new RegExp(`${LOCALE_PREFIX}/dashboard`));

  await page.getByRole("button", { name: "Location" }).click();

  const annex = page.getByRole("menuitemradio", {
    name: `${E2E_PREFIX} Annex`,
  });
  await expect(annex).toBeVisible();

  const annexLocationId = await annex.getAttribute("data-value");
  const todayRequest = page.waitForResponse(
    (response) =>
      response.url().includes(`/locations/${annexLocationId}/today`) &&
      response.request().method() === "GET",
  );

  await annex.click();
  await todayRequest;

  // Not HttpOnly by design, so the server render agrees with the client on reload.
  const cookies = await page.context().cookies();
  expect(
    cookies.find((cookie) => cookie.name === "haccp_location_id")?.value,
  ).toBe(annexLocationId);
});
