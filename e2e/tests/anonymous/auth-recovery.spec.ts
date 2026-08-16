import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX, storageStatePath } from "../../support/env.js";

test.describe("no organization", () => {
  test.use({ storageState: storageStatePath("noOrg") });

  test("a user with no organization is given a way forward", async ({
    page,
  }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);

    // Clerk's session task intercepts before the dashboard layout's own
    // /no-organization redirect can run, so that redirect is unreachable while
    // "force organization" is enabled on the instance.
    await expect(page).toHaveURL(/\/sign-in\/tasks\/choose-organization/);
    await expect(page.getByText(/sign out/i).first()).toBeVisible();
  });

  test("the no-organization page itself offers an exit", async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}/no-organization`);
    await expect(page.getByTestId("no-organization-card")).toBeVisible();

    // The exit used to link to "/", which sends a signed-in user to /dashboard and
    // straight back. Signing out is the only thing that breaks the cycle.
    await page.getByTestId("no-organization-sign-out").click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test("an invalid invitation ticket ends somewhere recoverable", async ({
  page,
}) => {
  await page.goto(
    `${LOCALE_PREFIX}/accept-invitation?__clerk_ticket=expired-ticket`,
  );

  // Without __clerk_status no branch of the accept flow can advance; this used to
  // render a loader indefinitely.
  await expect(page.getByTestId("invitation-invalid")).toBeVisible();
  await page.getByRole("link", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/sign-in/);
});
