# CLAUDE.md

Guidance for Claude Code when working in this repository. Keep this file under ~200 lines: tighten existing prose before adding new content, rather than letting it grow unbounded.

HACCP (Hazard Analysis and Critical Control Points) management platform for food-service sites: an admin configures locations, equipment and recurring task templates; staff work a daily "Today" checklist and log fridge/freezer temperatures.

## Stack & layout

Turborepo + pnpm workspaces, Node 24+, pnpm 10, TypeScript strict everywhere, Zod v4.

```
apps/web        Next.js 16 (App Router, React 19) + Tailwind v4 + shadcn — port 3000
apps/api        Hono + @hono/zod-openapi REST API, Drizzle/Postgres, Redis — port 3001
packages/shared @haccp/shared — Zod schemas + inferred types shared by both apps
packages/typescript-config, packages/eslint-config
supabase/       config only (hosted Postgres); local dev uses docker-compose
```

Deployed on Vercel (web + api as separate projects). Sentry only when `VERCEL_ENV=production`.
**Consult Context7 for a library's current behavior instead of relying on memory** — Next.js 16,
React 19, Tailwind v4, Zod v4, Clerk v7, next-intl v4, Base UI and `@hono/zod-openapi` v1 all
moved recently enough that recalled APIs likely describe a stale version. Check before writing
code, not after the failure.

## Commands

| Task | Command |
|---|---|
| Dev (web + api + shared watch) | `pnpm dev` |
| Build / lint / typecheck all | `pnpm build` \| `pnpm lint` \| `pnpm typecheck` |
| Tests (no root script — use turbo) | `pnpm turbo test` |
| One package's tests | `pnpm --filter @haccp/api test` |
| One test file | `pnpm --filter @haccp/api exec vitest run src/modules/today/today.mapper.test.ts` |
| Local Postgres 16 + Redis 7 | `pnpm docker:up` (creds `haccp/haccp/haccp`) |
| Migrations | `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:studio` |
| Format | `pnpm format` (Prettier defaults, no config file) |
| Scope any turbo task | `pnpm turbo build --filter=@haccp/web...` |

CI (`.github/workflows/ci.yml`) runs on PRs to `main` as separate checks: lint, typecheck, build
api, build web, unit tests (+ `test:discovery`), integration tests, browser smoke, and
`validate-migrations`. `migrate.yml` applies migrations on push to `main`. **`@haccp/shared` is
consumed from `dist/`** — turbo's `^build` handles this for `build`/`lint`/`typecheck`/`test`, but
if you edit shared and then run `tsc` or `vitest` directly in an app, rebuild first:
`pnpm --filter @haccp/shared build`.

## Environment setup

Env files are git-ignored and **required**. The API's `dev`/`start`/`db:*` scripts pass
`--env-file=.env --env-file=.env.local`, so **both files must exist in `apps/api/`** or the
process won't start.
- `apps/api/.env` + `.env.local` — `DATABASE_URL`, `DIRECT_DATABASE_URL`, `REDIS_URL`,
  `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (validated at import in `apps/api/src/env.ts`;
  non-empty placeholders are enough to boot, migrate and hit `/health`).
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL`, Clerk publishable/secret keys.
- Real Clerk dev keys are needed for any authenticated flow. Everything except `/health`,
  `/webhooks` and dev docs sits behind `requireAuth`. Health check: `curl localhost:3001/health`
  → `{"status":"ok","database":"connected","redis":"connected"}`. API `/` serves Swagger UI in
  development only.

## API architecture (`apps/api`)

- **Layering**: `<module>.routes.ts` (HTTP only: OpenAPI defs, parse input, call service) →
  `<module>.service.ts` (use cases, business rules, domain errors) → `<module>.repository.ts`
  (all Drizzle/SQL, returns rows or `null`, throws only on DB failure) → `<module>.mapper.ts`
  (db row → API shape: numeric → `Number`, Date → ISO string). Routes never touch the db.
- **Query performance**: no N+1 (join/subquery/batched `inArray`, not per-item loops; build a
  lookup `Map` once for in-memory joins, O(n+m) not O(n×m)); filter/sort/paginate/count in SQL,
  never over-fetch; prefer a conditional write (`updateById` returning `null`) over
  read-then-write; wrap multi-statement writes in a transaction; match `where`/`join` to existing
  indexes; name methods for what they do (`findManyByLocation`) and reuse existing ones.
- **Request pipeline** (`src/routes/index.ts`): `dbMiddleware` → `requireAuth` (verifies the
  Clerk JWT, sets `userId`/`orgId`/`orgRole`) → `requestContextMiddleware` (resolves tenant +
  user + membership, provisioning just-in-time on miss) → optional `requireOrgAdmin` → optional
  `locationParamMiddleware` (validates `:locationId` against tenant + caller's assignments).
  Mount via `mountProtected` / `mountAdminProtected` / `mountLocationScoped`, not by hand.
  Registration order matters: `/locations/:locationId/*` routers must register **before** the
  admin `/locations` router, or Hono runs admin middleware on every `/locations/*` path.
- **Reading request state**: always through `src/lib/context.ts` (`getDb`, `getTenant`,
  `getCurrentLocation`, `getCurrentOrganization`, `requireOrgContext`), never `c.get(...)`
  directly; these throw `InternalError` when a middleware that should have populated the value
  didn't run.
- **Errors**: throw the `AppError` subclasses from `src/core/errors/app-errors.ts`
  (`NotFoundError`, `ConflictError`, `ForbiddenError`, `ServiceUnavailableError`, …). The global
  handler serializes `{ error, message, details?, requestId }` (`apiErrorSchema`) and reports
  5xx — except 503 — to Sentry. Translate driver errors with `mapDbMutationError(error, { unique,
  foreignKey })` from `src/lib/db-errors.ts`; use `isContention` for a lost insert race.
- **Plain admin CRUD** should use `registerAdminCrudRoutes` from
  `src/core/openapi/route-factory.ts` — pass schemas + a service with `list/create/update/delete`
  and it generates all four documented routes. `equipment` is the smallest end-to-end example.
- **Multi-tenancy**: Clerk org → `organizations` row (`clerkOrgId`), which owns `locations`,
  which own `equipment` / `task_templates`. `assignedLocationIds` is `null` for admins ("all
  locations"), or an explicit list for members. Tenant/membership blobs are cached in Redis
  (2-day TTL, `tenant:clerk:*` / `membership:clerk:*`) — **invalidate on every write that
  changes org, locations, memberships or roles**; cache failures log and fall through to
  Postgres, never throw.
- **Imports use explicit `.js` extensions** (`tsconfig` is `NodeNext`):
  `import { env } from "../env.js"`.

## Web architecture (`apps/web`)

Feature modules live in `src/features/<name>/`: a single `<name>-manager.tsx` or
`<name>-view.tsx` orchestrator at the root, plus `<name>-form.tsx` and, only once they hold
something, `components/`, `hooks/`, `lib/`, `data-table/{columns,data,mobile-card,row-actions}`.
No barrel `index.ts` — import direct paths via the `@/` alias. Types and schemas come from
`@haccp/shared`, never redefined locally. The rest of `src/`: `app/` is routes only (thin pages
that compose features), `components/ui/` is shadcn primitives with no business logic,
`components/layout/` is the app shell, `components/auth/` is auth UI, and `hooks/` holds shared
UI hooks (`use-mobile`, `use-now`).
- **Data flow**: Server Component pages fetch through `src/lib/api/server.ts` (Clerk token +
  `cache: "no-store"`; `getTenantContext` is React-`cache`d per render) and pass results as
  `initialData` into `use*Query` hooks. Client reads/writes use `useAuthenticatedFetch` from
  `src/lib/api/client.ts`, always parsing responses with the shared Zod schema. Every query key
  lives in `src/lib/api/query-keys.ts` and is scoped by `locationId` or `organizationId` so a
  location/org switch can't serve another tenant's cached rows; mutations invalidate related
  keys (e.g. an equipment edit also invalidates `todayByLocation`).
- **Active location** comes from `TenantProvider` (`src/features/tenant/tenant-provider.tsx`) —
  `useLocation()` / `useTenant()`; the preference is persisted in the `haccp_location_id` cookie
  so the server render agrees with the client.
- **Shell & layout**: pages render inside `PageContainer` (`width="narrow"` for forms,
  `"content"` for tables). Mobile chrome is filled via the portal slots in
  `components/layout/shell-slots.tsx` (`MobileHeaderTitle`, `MobileHeaderActions`,
  `ShellOverlay`) — use `ShellOverlay` instead of `position: fixed`, which resolves against the
  drawer-transformed panel on mobile.
- **UI rules**: compose from `@/components/ui/*` (shadcn, style `base-vega`, icons
  `lucide-react`) — never a native element for interactive/styled UI: map
  button/input/textarea/select/checkbox/toggle/modal/tooltip/dropdown/`<a>`-as-button to
  `Button`/`Input`/`Textarea`/`Select`(`Combobox`)/`Checkbox`/`Switch`/`Dialog`(`AlertDialog`)/
  `Tooltip`/`DropdownMenu`(`Popover`)/`Button asChild`. Semantic-only elements (`<main>`,
  `<section>`, `<nav>`, headings, `<p>`) are fine. Missing primitive? Check `src/components/ui/`
  first, then `pnpm dlx shadcn@latest add <component>` from `apps/web` — don't hand-roll one.
  Always handle loading/empty/error/success states (`Skeleton`, `Empty`, `Alert`, Sonner toasts);
  use design tokens (`bg-background`, `text-muted-foreground`, `border`) over one-off styles; one
  primary action per view; destructive actions get `variant="destructive"` behind confirmation;
  pair every input with a label and inline validation.
- **i18n**: `next-intl`, locales `bg` (default) and `en`, `localePrefix: "as-needed"`, routes
  under `src/app/[locale]/`. **Any user-facing string must be added to both `messages/en.json`
  and `messages/bg.json`** — currently at exact key parity (438 each). Pages call
  `setRequestLocale(locale)` before rendering; middleware is `src/proxy.ts` (Clerk + intl), not
  `middleware.ts`.

## Database & migrations

Schema: `apps/api/src/core/db/schema/*.ts`, re-exported from `index.ts`. Drizzle + `postgres.js`.
**Migrations are generated, never hand-written** (`apps/api/drizzle/README.md` explains the
snapshot-drift incident that made this a hard rule): edit the schema, run
`pnpm --filter @haccp/api db:generate --name <action>_<subject>`, then `db:migrate`, then commit
the schema change, the `.sql`, and `meta/` together.
- Name migrations `NNNN_<action>_<subject>.sql`; never keep drizzle-kit's random names. If one
  slipped through, rename both the `.sql` and its `tag` in `meta/_journal.json`.
- CI fails the PR if `db:check` generates anything (drift) — commit the snapshot. Never run
  `drizzle-kit push` against a real database or `generate --custom` to repair snapshots.
- `DIRECT_DATABASE_URL` (port 5432) is for migrations; `DATABASE_URL` (pooled, 6543) for the app.

## Testing

**Tests are part of the change, not a follow-up.** New behaviour ships with tests. Changing
existing behaviour means revising the tests that cover it — if none do, that gap is part of the
work. A bug fix starts with a test that fails for the stated reason, so the fix is proven rather
than asserted. Match the layer to the claim: pure logic and mocked boundaries in the unit suites,
anything crossing the database, cache or Clerk in the integration harness. If a change genuinely
needs no test, say why in the PR.

Vitest, colocated `*.test.ts`; `apps/api/vitest.config.ts` injects placeholder env vars since
`src/env.ts` validates at import, and **no unit test opens a real DB, Redis or Clerk connection**.
Every `vitest.config` builds on `defineUnitConfig` from `@haccp/vitest-config/unit`, anchoring
discovery to `src/**/*.test.ts`: Vitest 4's default `exclude` is only `node_modules` and `.git`,
so a bare config also collects the compiled copies in `dist`. `pnpm test:discovery` compares what
Vitest collects against what git tracks (run it after a build). `build` uses
`tsconfig.build.json` so tests never ship in `dist`, while `typecheck` still covers them — add new
test globs to **both**.

`apps/api/tests/integration/` uses **real Postgres and Redis**, only Clerk mocked: `pnpm
docker:up`, then `pnpm --filter @haccp/api test:integration`. **Extend this harness rather than
build new infrastructure** — `harness/` has tenant fixtures, `apiRequest`/`asAdmin`/`asEmployee`,
a Clerk fake with injectable failure modes, `failRedisCommands`, and `PG_ERROR`. Traps: fixture
ids are minted per call because `users.email` is unique **globally, not per tenant**; the actor's
role rides on the token, since `requireOrgAdmin` reads the raw `org_role` claim, not the database
row; the suite is single-worker because the db/Redis clients are module-scope singletons and
`single-flight` is process-global. Global setup drops and recreates `haccp_test` (name must end
in `_test`). Logs are silenced — set `INTEGRATION_LOG_LEVEL=debug`.

`e2e/` is a focused Playwright smoke suite over the journeys protecting compliance writes,
signing in against a Clerk **dev** instance via `@clerk/testing` — it needs one-time users seeded
there (`e2e/README.md`) and skips in CI until the secrets exist. `data-testid` is an E2E anchor
only; prefer role/label queries, and never assert on translated strings — the config pins `en`
because `localePrefix` is "as-needed" with `bg` as default.

## Git workflow

Never work directly on `main`. Branch first — `git checkout main && git pull`, then
`git checkout -b <type>/<short-description>`, lowercase and hyphenated, prefixed `feat`, `fix`,
`chore`, `refactor`, `docs` or `test` (`feat/employee-invites`, `fix/login-redirect-loop`).
Commits follow Conventional Commits: `<type>(<optional scope>): <summary>` — imperative mood, no
trailing period, ≤72 chars, one logical change each (`fix(auth): redirect unauthenticated users
to sign-in`). Types add `perf`, `ci` and `build` to the branch prefixes; scope is a module or
area (`employees`, `web`, `api`, `ci`). Land everything through a PR against `main` — never a
local merge; PR title takes the same shape as a commit summary, with a short summary, test plan
and any related issue in the body. Commit only when the user asks; offer to push and open the PR
once the work is done.

## Conventions & gotchas

- Adding a schema to `@haccp/shared` requires a **manual entry in `packages/shared/src/index.ts`**
  — it's an explicit re-export barrel, not `export *`.
- Timezone-sensitive logic (task status, "today") must take the organisation's `timeZone`
  explicitly; helpers in `packages/shared/src/lib/timezone.ts` enforce this. Server renders run
  in UTC on Vercel, so never default a date to the local zone.
- Temperatures are Postgres `numeric` — mappers convert with `Number(...)`, services write
  `String(...)`.
- Clerk token verification distinguishes a bad token (401) from an upstream/JWKS failure (503) on
  purpose: the web app reads 401 as "signed out", so a Clerk blip must not sign out every tablet.
- Web dialogs/sheets stay mounted with `open` toggled (Base UI owns the exit transition) —
  unmounting them cuts the animation.
- **Comments**: only add one when the **WHY** is non-obvious — a hidden constraint, a subtle
  invariant, a workaround for a specific bug, or behavior that would surprise a reader. Never
  comment what the code does; well-named identifiers already do that. Keep it to one short
  line — never a multi-line or paragraph comment. When touching existing code, judge its
  existing comments by the same bar — rewrite or delete ones that are stale, restate the code,
  are overlong, or no longer meet it; don't leave them unexamined.
