import { expect, test } from "@playwright/test";
import {
  clerkFrontendApiHost,
  LOCALE_PREFIX,
  storageStatePath,
} from "../../support/env.js";

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

test.describe("invitation completion failure", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("a failed token refresh during completion does not hang forever", async ({
    page,
  }) => {
    // Clerk's internal retry loop on the failing request alone takes ~15s.
    test.setTimeout(60000);

    // An already signed-in admin with no ticket takes the same "invitationAccepted"
    // branch a real invitee reaches right after Clerk's SignIn/SignUp component
    // redirects back — no need to mint a real invitation ticket to exercise it.
    await page.route(`https://${clerkFrontendApiHost()}/**`, async (route) => {
      if (route.request().url().includes("/tokens")) {
        // A 500 rejects getToken() directly; aborting the connection instead lets
        // Clerk's own network-error retry loop swallow it for longer than any
        // reasonable test timeout.
        await route.fulfill({ status: 500, body: "{}" });
        return;
      }
      await route.continue();
    });

    await page.goto(`${LOCALE_PREFIX}/accept-invitation`);

    // Used to fall through to a bare FullPageLoader forever on a rejected getToken().
    // Clerk retries the failing request several times internally before it rejects,
    // so this needs real headroom beyond the default assertion timeout.
    await expect(
      page.getByTestId("invitation-completion-error"),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByTestId("invitation-completion-retry"),
    ).toBeVisible();
    // Not clicked: it signs out the real underlying Clerk session behind the
    // shared "admin" fixture, which every other test in the run reuses. The
    // sign-out mechanism itself is already exercised end-to-end by the
    // no-organization test above, using the dedicated "noOrg" fixture instead.
    await expect(
      page.getByTestId("invitation-completion-sign-out"),
    ).toBeVisible();
  });
});
