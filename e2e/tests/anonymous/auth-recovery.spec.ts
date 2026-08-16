import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX, storageStatePath } from "../../support/env.js";

test.describe("no organization", () => {
  test.use({ storageState: storageStatePath("noOrg") });

  test("a user with no organization is redirected and can get out", async ({
    page,
  }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
    await expect(page).toHaveURL(
      new RegExp(`${LOCALE_PREFIX}/no-organization`),
    );
    await expect(page.getByTestId("no-organization-card")).toBeVisible();

    // The exit used to link to "/", which sends a signed-in user to /dashboard and
    // straight back here. Signing out is the only thing that actually breaks the cycle.
    await page.getByTestId("no-organization-sign-out").click();
    await expect(page).toHaveURL(new RegExp(`${LOCALE_PREFIX}/sign-in`));
  });
});

test.describe("invitation failures", () => {
  test("a rejected invitation ticket ends in a recoverable state", async ({
    page,
  }) => {
    // Force the failure: a real expired ticket cannot be minted on demand.
    await page.route("**/v1/client/sign_ins**", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          errors: [
            { code: "invalid_ticket", message: "Invitation is invalid" },
          ],
        }),
      }),
    );

    await page.goto(
      `${LOCALE_PREFIX}/accept-invitation?__clerk_ticket=expired-ticket`,
    );

    // The failure mode this guards is an endless spinner, or a replace() loop
    // between accept-invitation and the dashboard.
    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .not.toMatch(/\/dashboard/);

    await expect(
      page.getByRole("link", { name: /sign in/i }).or(page.getByRole("button")),
    ).toBeVisible();
  });
});
