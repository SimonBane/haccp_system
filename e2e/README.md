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

1. Enable the **password** sign-in strategy on the dev instance.
2. Create one organization.
3. Create three users:
   - an **admin** member of that organization,
   - an ordinary **member** of it,
   - a user belonging to **no organization**.
4. Put their emails and passwords in the environment (below). Use throwaway passwords; these
   accounts hold no real data.

Everything else the journeys need — the tenant row, the annex location, 11 equipment rows and
two task templates — is created by `tests/setup/seed.setup.ts` through the API on each run.
The API provisions the organization, user and membership just-in-time from Clerk, so no
database seeding is required.

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk **dev** instance |
| `E2E_CLERK_ADMIN_EMAIL` / `_PASSWORD` | org admin |
| `E2E_CLERK_EMPLOYEE_EMAIL` / `_PASSWORD` | org member |
| `E2E_CLERK_NO_ORG_EMAIL` / `_PASSWORD` | user with no organization |
| `E2E_WEB_URL`, `E2E_API_URL` | override the default localhost ports |

`playwright.config.ts` starts both servers itself (`@haccp/api start:ci` and
`@haccp/web start`), so build first: `pnpm turbo build`.

## Conventions

`data-testid` is an E2E anchor only. Prefer role and label queries when an element already has
a unique accessible name; never assert on translated strings — the app ships `bg` and `en` at
key parity and the default locale is `bg`, so the config pins `en` for determinism.

The suite runs single-worker against one API, one database and one Clerk instance. Journeys
share the seeded fixtures, so keep them independent of each other's writes.
