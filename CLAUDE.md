# CLAUDE.md

Guidance for Claude Code when working in this repository.

HACCP (Hazard Analysis and Critical Control Points) management platform for food-service
sites: an admin configures locations, equipment and recurring task templates; staff work a
daily "Today" checklist and log fridge/freezer temperatures.

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

**When implementation depends on a library's or API's current behavior or syntax, consult
Context7 documentation rather than relying on memory.** Much of this stack is new enough that
recalled APIs are likely to describe a previous major version — Next.js 16, React 19, Tailwind v4,
Zod v4, Clerk v7, next-intl v4, Base UI and `@hono/zod-openapi` v1 all moved in ways that are easy
to get subtly wrong. Check before writing the code, not after the failure.

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

CI (`.github/workflows/ci.yml`) runs on PRs to `main`: build api, build web, `turbo test`, and
`validate-migrations`. `migrate.yml` applies migrations on push to `main`.

**`@haccp/shared` is consumed from `dist/`.** Turbo's `^build` handles this for
`build`/`lint`/`typecheck`/`test`, but if you edit shared and then run `tsc` or `vitest`
directly in an app, rebuild first: `pnpm --filter @haccp/shared build`.

## Environment setup

Env files are git-ignored and **required**. The API's `dev`/`start`/`db:*` scripts pass
`--env-file=.env --env-file=.env.local`, so **both files must exist in `apps/api/`** or the
process won't start.

- `apps/api/.env` + `.env.local` — `DATABASE_URL`, `DIRECT_DATABASE_URL`, `REDIS_URL`,
  `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (all validated at import in `apps/api/src/env.ts`;
  non-empty placeholders are enough to boot, migrate and hit `/health`).
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL`, Clerk publishable/secret keys.
- Real Clerk dev keys are needed for any authenticated flow. Everything except `/health`,
  `/webhooks` and dev docs sits behind `requireAuth`.

Health check: `curl localhost:3001/health` → `{"status":"ok","database":"connected","redis":"connected"}`.
API `/` serves Swagger UI in development only.

## API architecture (`apps/api`)

**Strict layering:**

```
<module>.routes.ts      HTTP only: OpenAPI route defs, parse input, call service
<module>.service.ts     use cases, business rules, domain errors
<module>.repository.ts  ALL Drizzle/SQL; returns rows or null
<module>.mapper.ts      db row -> API response shape (numeric -> Number, Date -> ISO string)
```

Routes never touch the db and carry no business logic. Services orchestrate use cases and own the
domain errors. Repositories hold every query, return rows or `null`, and throw only on DB failure.

**Query performance** — the standing rules:

- **No N+1.** Never fetch a list then loop with per-item queries; use a join, a subquery, or a
  batched `inArray`. When joining two result sets in memory, build a lookup `Map` once — O(n + m),
  not O(n × m).
- **Filter, sort, paginate and count in SQL**, not in memory after over-fetching. Select only the
  columns you need, and never load an unbounded result set.
- **Prefer one conditional write to read-then-write**: an `updateById` that returns `null` tells
  you the row was missing in one roundtrip instead of two.
- Wrap multi-statement writes in a transaction. Structure `where`/`join` conditions to match
  existing indexes; don't wrap an indexed column in a function.
- Name methods for what they do (`findManyByLocation`, `assertLocationBelongsToOrganization`), and
  reuse existing repository methods rather than duplicating a query.

**Request pipeline** (`src/routes/index.ts`): `dbMiddleware` → `requireAuth` (verifies the Clerk
JWT, sets `userId`/`orgId`/`orgRole`) → `requestContextMiddleware` (resolves tenant + user +
membership, provisioning just-in-time on miss) → optional `requireOrgAdmin` → optional
`locationParamMiddleware` (validates `:locationId` against the tenant and the caller's
assignments). Mount via the `mountProtected` / `mountAdminProtected` / `mountLocationScoped`
helpers rather than wiring middleware by hand.

> Registration order matters: `/locations/:locationId/*` routers must be registered **before**
> the admin `/locations` router, or Hono runs admin middleware on every `/locations/*` path.

**Reading request state** — always through `src/lib/context.ts` (`getDb`, `getTenant`,
`getCurrentLocation`, `getCurrentOrganization`, `requireOrgContext`), never `c.get(...)` directly.
These throw `InternalError` when a middleware that should have populated the value didn't run.

**Errors**: throw the `AppError` subclasses from `src/core/errors/app-errors.ts`
(`NotFoundError`, `ConflictError`, `ForbiddenError`, `ServiceUnavailableError`, …). The global
handler serializes `{ error, message, details?, requestId }` (`apiErrorSchema`) and reports 5xx —
except 503 — to Sentry. Translate driver errors with `mapDbMutationError(error, { unique, foreignKey })`
from `src/lib/db-errors.ts`; use `isContention` when a caller recovers from a lost insert race.

**Plain admin CRUD** should use `registerAdminCrudRoutes` from `src/core/openapi/route-factory.ts`
— pass schemas + a service with `list/create/update/delete` and it generates all four documented
routes. `equipment` and `task-templates` are the reference implementations; `equipment` is the
smallest end-to-end example of the whole stack.

**Multi-tenancy**: Clerk org → `organizations` row (`clerkOrgId`), which owns `locations`, which
own `equipment` / `task_templates`. `assignedLocationIds` is `null` for admins meaning "all
locations"; for members it's their explicit assignment list. Tenant and membership blobs are
cached in Redis (2-day TTL, `tenant:clerk:*` / `membership:clerk:*`) — **invalidate on every
write that changes org, locations, memberships or roles**. Cache failures log and fall through to
Postgres, never throw.

**Imports use explicit `.js` extensions** (`tsconfig` is `NodeNext`): `import { env } from "../env.js"`.

## Web architecture (`apps/web`)

Feature modules live in `src/features/<name>/`:

```
features/<name>/
  <name>-manager.tsx | <name>-view.tsx   single orchestrator at the root
  <name>-form.tsx
  components/  hooks/  lib/  data-table/{columns,data,mobile-card,row-actions}
```

Create `components/` / `hooks/` / `lib/` only once they hold something — no empty scaffolding. No
barrel `index.ts` — import direct paths via the `@/` alias. Types and schemas come from
`@haccp/shared`, never redefined locally.

The rest of `src/`: `app/` is routes only (thin pages that compose features), `components/ui/` is
shadcn primitives with no business logic, `components/layout/` is the app shell, `components/auth/`
is auth UI, and `hooks/` holds shared UI hooks (`use-mobile`, `use-now`).

**Data flow**: Server Component pages fetch through `src/lib/api/server.ts` (Clerk token +
`cache: "no-store"`; `getTenantContext` is React-`cache`d per render) and pass results as
`initialData` into `use*Query` hooks. Client reads/writes use `useAuthenticatedFetch` from
`src/lib/api/client.ts`, always parsing responses with the shared Zod schema. Every query key
lives in `src/lib/api/query-keys.ts` and is scoped by `locationId` or `organizationId` so a
location/org switch can't serve another tenant's cached rows; mutations invalidate related keys
(e.g. an equipment edit also invalidates `todayByLocation`).

**Active location** comes from `TenantProvider` (`src/features/tenant/tenant-provider.tsx`) —
`useLocation()` / `useTenant()`; the preference is persisted in the `haccp_location_id` cookie so
the server render agrees with the client.

**Shell & layout**: pages render inside `PageContainer` (`width="narrow"` for forms, `"content"`
for tables). Mobile chrome is filled via the portal slots in `components/layout/shell-slots.tsx`
(`MobileHeaderTitle`, `MobileHeaderActions`, `ShellOverlay`) — use `ShellOverlay` instead of
`position: fixed`, which resolves against the drawer-transformed panel on mobile.

**UI rules**: compose from `@/components/ui/*` (shadcn, style `base-vega`, icons `lucide-react`).
Never reach for a native element for interactive or styled UI — `<button>`→`Button`,
`<input>`→`Input`, `<textarea>`→`Textarea`, `<select>`→`Select`/`Combobox`, checkbox→`Checkbox`,
toggle→`Switch`, custom modal→`Dialog`/`AlertDialog`, `title` tooltip→`Tooltip`, custom
dropdown→`DropdownMenu`/`Popover`, `<a>` styled as a button→`Button asChild`. Semantic-only
elements (`<main>`, `<section>`, `<nav>`, headings, `<p>`) are fine. Missing primitive? Look in
`src/components/ui/` first, then `pnpm dlx shadcn@latest add <component>` from `apps/web` — don't
hand-roll an equivalent.

Always handle loading / empty / error / success states (`Skeleton`, `Empty`, `Alert`, Sonner
toasts). Use design tokens (`bg-background`, `text-muted-foreground`, `border`) over one-off
styles. One primary action per view; destructive actions use `variant="destructive"` behind a
confirmation. Pair every input with a label and surface inline validation.

**i18n**: `next-intl`, locales `bg` (default) and `en`, `localePrefix: "as-needed"`. All routes
live under `src/app/[locale]/`. **Any user-facing string must be added to both
`messages/en.json` and `messages/bg.json`** — they're currently at exact key parity (438 each).
Pages call `setRequestLocale(locale)` before rendering. Middleware is `src/proxy.ts`
(Clerk + intl), not `middleware.ts`.

## Database & migrations

Schema: `apps/api/src/core/db/schema/*.ts`, re-exported from `index.ts`. Drizzle + `postgres.js`.

**Migrations are generated, never hand-written** (`apps/api/drizzle/README.md` explains the
snapshot-drift incident that made this a hard rule):

```bash
# edit src/core/db/schema/*.ts, then:
pnpm --filter @haccp/api db:generate --name create_organizations_and_replace_org_id
pnpm --filter @haccp/api db:migrate
# commit the schema change, the .sql, AND meta/ together
```

- Name migrations `NNNN_<action>_<subject>.sql`; never keep drizzle-kit's random names. If one
  slipped through, rename both the `.sql` and its `tag` in `meta/_journal.json`.
- CI fails the PR if `db:check` generates anything (schema/migration drift) — commit the snapshot.
- Never run `drizzle-kit push` against a real database; never use `generate --custom` to repair
  snapshots.
- `DIRECT_DATABASE_URL` (port 5432) is for migrations; `DATABASE_URL` (pooled, 6543) for the app.

## Testing

Vitest, colocated `*.test.ts`. Coverage is deliberately thin and unit-level — pure logic
(`today.mapper`, `optimistic`, `today-timeline`, `timezone`) and mocked-boundary tests
(`auth`, `provisioning`). `apps/api/vitest.config.ts` injects placeholder env vars because
`src/env.ts` validates at import; **nothing here opens a real DB, Redis or Clerk connection** —
keep it that way and put anything needing real infrastructure in a separate integration suite.

Every package's `vitest.config` builds on `defineUnitConfig` from `@haccp/vitest-config/unit`,
which anchors discovery to `src/**/*.test.ts` and excludes build output. This matters: Vitest 4's
default `exclude` is only `node_modules` and `.git`, so a bare config collects the compiled tests
in `dist` as a second, stale copy of every suite. `pnpm test:discovery` compares what Vitest
collects against what git tracks and fails on duplicates or build artifacts — run it after a
build, since that is the only time the regression exists.

`build` uses `tsconfig.build.json` (tests excluded, so they never ship in `dist`); `typecheck`
uses `tsconfig.json` and still covers them. Add new test globs to **both** the vitest preset and
`tsconfig.build.json`'s `exclude`.

## Git workflow

Never work directly on `main`. Branch first — `git checkout main && git pull`, then
`git checkout -b <type>/<short-description>`, lowercase and hyphenated, prefixed `feat`, `fix`,
`chore`, `refactor`, `docs` or `test` (`feat/employee-invites`, `fix/login-redirect-loop`).

Commits follow Conventional Commits: `<type>(<optional scope>): <summary>` — imperative mood, no
trailing period, ≤72 chars, one logical change each. Types add `perf`, `ci` and `build` to the
branch prefixes; scope is a module or area (`employees`, `web`, `api`, `ci`).

```
feat(employees): add bulk invite endpoint
fix(auth): redirect unauthenticated users to sign-in
```

Land everything through a PR against `main` — never a local merge. PR title takes the same shape
as a commit summary; the body gets a short summary, a test plan, and any related issue. Commit
only when the user asks; offer to push and open the PR once the work is done.

## Conventions & gotchas

- Adding a schema to `@haccp/shared` requires a **manual entry in `packages/shared/src/index.ts`**
  — it's an explicit re-export barrel, not `export *`.
- Timezone-sensitive logic (task status, "today") must take the organisation's `timeZone`
  explicitly; helpers in `packages/shared/src/lib/timezone.ts` enforce this. Server renders run in
  UTC on Vercel, so never default a date to the local zone.
- Temperatures are Postgres `numeric` — mappers convert with `Number(...)`, services write
  `String(...)`.
- Clerk token verification distinguishes a bad token (401) from an upstream/JWKS failure (503) on
  purpose: the web app reads 401 as "signed out", so a Clerk blip must not sign out every tablet.
- Web dialogs/sheets stay mounted with `open` toggled (Base UI owns the exit transition);
  unmounting them cuts the animation.
