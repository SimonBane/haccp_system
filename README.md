# HACCP System

HACCP (Hazard Analysis and Critical Control Points) management platform for food-service
sites: an admin configures locations, equipment and recurring task templates; staff work a
daily "Today" checklist and log fridge/freezer temperatures.

## Stack

- **Monorepo:** Turborepo + pnpm workspaces, Node 24+, pnpm 10, TypeScript strict, Zod v4
- **Web:** Next.js 16 (App Router, React 19) + Tailwind v4 + shadcn — `apps/web`, port 3000
- **API:** Hono + `@hono/zod-openapi` REST API, Drizzle/Postgres, Redis — `apps/api`, port 3001
- **Shared:** `@haccp/shared` — Zod schemas + inferred types used by both apps

Deployed on Vercel (web and API as separate projects).

## Prerequisites

- Node.js 24+
- pnpm 10+
- Docker (for local Postgres + Redis)

## Getting started

Copy the required environment files — see [Environment files](#environment-files) below for
what each variable needs:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
touch apps/api/.env.local
```

Start local Postgres and Redis, then apply migrations:

```bash
pnpm docker:up
pnpm db:migrate
```

Install dependencies and start web + API + the shared package's build watcher:

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health (`{"status":"ok","database":"connected","redis":"connected"}`)
- API docs (Swagger UI, development only): http://localhost:3001/

## Environment files

Env files are git-ignored and required — the API's `dev`/`start`/`db:*` scripts load
`--env-file=.env --env-file=.env.local`, so **both files must exist in `apps/api/`** or the
process won't start.

| File | Required for |
|---|---|
| `apps/api/.env.example` → `.env` | `DATABASE_URL`, `DIRECT_DATABASE_URL`, `NODE_ENV` |
| `apps/api/.env.example` → `.env.local` | Local overrides (Docker URLs) and `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` (`clerk env pull` from `apps/api`) |
| `apps/web/.env.example` → `.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |

Non-empty placeholders are enough to boot, migrate and hit `/health`; real Clerk dev keys are
needed for any authenticated flow (everything except `/health`, `/webhooks` and dev docs sits
behind `requireAuth`).

In production, the API refuses to start and the web build fails if a public URL is missing,
points at `localhost`, uses `http://` instead of `https://`, or looks like a placeholder — see
`apps/api/src/env.ts` and `apps/web/src/env.ts`.

## Scripts

| Task | Command |
|---|---|
| Dev (web + api + shared watch) | `pnpm dev` |
| Build / lint / typecheck all | `pnpm build` \| `pnpm lint` \| `pnpm typecheck` |
| Tests (no root script — use turbo) | `pnpm turbo test` |
| One package's tests | `pnpm --filter @haccp/api test` |
| Local Postgres 16 + Redis 7 | `pnpm docker:up` (creds `haccp/haccp/haccp`), `pnpm docker:down`, `pnpm docker:reset` |
| Migrations | `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:studio` |
| Format | `pnpm format` (Prettier defaults) |
| Scope any turbo task | `pnpm turbo build --filter=@haccp/web...` |

## Project structure

```
apps/
  web/                 Next.js 16 frontend (App Router)
  api/                 Hono REST API (mobile-ready)
packages/
  shared/              Shared Zod schemas and inferred types
  typescript-config/   Shared TypeScript configs
  eslint-config/       Shared ESLint configs
supabase/              Config only — hosted Postgres (local dev uses docker-compose)
e2e/                   Playwright smoke suite
```

## CI

`.github/workflows/ci.yml` runs on every PR to `main`: lint, typecheck, build (api, web), unit
tests, integration tests (real Postgres + Redis), browser smoke, and migration drift
validation. `.github/workflows/migrate.yml` applies migrations on push to `main`.
