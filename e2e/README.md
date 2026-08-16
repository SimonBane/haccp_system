# @haccp/e2e

Focused browser journeys that protect compliance writes. Deliberately small — this is a
smoke suite, not broad UI coverage.

```bash
pnpm --filter @haccp/e2e exec playwright install --with-deps chromium
pnpm turbo test:e2e --filter=@haccp/e2e
```

## One-time Clerk setup

The suite signs in against a Clerk **development** instance — never production. Someone with
Clerk dashboard access has to create these once, because accounts cannot be provisioned from
the test run:

1. Create one organization.
2. Create three users: an **admin** member of it, an ordinary **member**, and one belonging to
   **no organization**.
3. Put their email addresses in the environment (below).

No passwords are needed. `clerk.signIn` mints a server-side token from `CLERK_SECRET_KEY`, which
also sidesteps the device-trust step that leaves a password sign-in stuck on
`needs_client_trust`.

Everything else the journeys need — the tenant row, the annex location, 11 equipment rows and
two task templates — is created by `tests/setup/seed.setup.ts` through the API on each run.
The API provisions the organization, user and membership just-in-time from Clerk, so no
database seeding is required.

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk **dev** instance |
| `E2E_CLERK_ADMIN_EMAIL` | org admin |
| `E2E_CLERK_EMPLOYEE_EMAIL` | org member |
| `E2E_CLERK_NO_ORG_EMAIL` | user with no organization |
| `E2E_WEB_URL`, `E2E_API_URL` | override the default localhost ports |

`playwright.config.ts` starts both servers itself (`@haccp/api start:ci` and
`@haccp/web start`), so build first: `pnpm turbo build`.

## Conventions

`data-testid` is an E2E anchor only. Prefer role and label queries when an element already has
a unique accessible name; never assert on translated strings — the app ships `bg` and `en` at
key parity and the default locale is `bg`, so the config pins `en` for determinism.

The suite runs single-worker against one API, one database and one Clerk instance. Journeys
share the seeded fixtures, so keep them independent of each other's writes.
