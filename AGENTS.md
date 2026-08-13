# AGENTS.md

Architecture, stack conventions, and coding rules live in `CLAUDE.md` — that's the source of
truth for both agents. This file only covers Cursor Cloud VM caveats that don't apply anywhere
else.

## Cursor Cloud specific instructions

HACCP System — a Turborepo + pnpm monorepo. Two apps: `apps/web` (Next.js 16, port 3000) and `apps/api` (Hono REST API, port 3001). Shared code in `packages/shared`. Standard commands live in the root `README.md` and `package.json` / per-app `package.json` scripts — use those; the notes below only cover non-obvious cloud caveats.

### Services and how to run them

| Service | Command | Port | Notes |
|---|---|---|---|
| Web + API (dev) | `pnpm dev` | 3000 / 3001 | `turbo dev`; also builds `@haccp/shared` in watch mode |
| Postgres 16 + Redis 7 | `pnpm docker:up` | 5432 / 6379 | via `docker-compose.yml`; creds `haccp/haccp/haccp` |
| DB migrations | `pnpm db:migrate` | — | drizzle-kit; run after Postgres is up |
| Build / typecheck / lint | `pnpm build` / `pnpm typecheck` / `pnpm lint` | — | turbo across all packages |

API health check: `curl http://localhost:3001/health` → `{"status":"ok","database":"connected","redis":"connected"}`. API root `/` serves Swagger UI in development.

### Non-obvious startup caveats (read before running)

- **Docker daemon is not auto-started.** systemd is unavailable in this VM, so `dockerd` does not run on boot. Before `pnpm docker:up`, start it once per session and make the socket usable by the `ubuntu` user:
  - `sudo dockerd > /tmp/dockerd.log 2>&1 &` (or run it inside a tmux session)
  - `sudo chmod 666 /var/run/docker.sock`
  - The Postgres/Redis containers use `restart: unless-stopped`, so once `dockerd` is running they come back automatically; otherwise run `pnpm docker:up`.
  - Docker is configured with the `fuse-overlayfs` storage driver and `containerd-snapshotter` disabled (see `/etc/docker/daemon.json`) — required for this kernel. Do not switch to `overlay2`.

- **Env files are required and git-ignored** (so they are not in the repo). The API `dev`/`start`/`db:*` scripts pass BOTH `--env-file=.env --env-file=.env.local`, so **both files must exist** in `apps/api/` or the process fails to start. If missing, recreate:
  - `apps/api/.env` and `apps/api/.env.local`: `DATABASE_URL`, `DIRECT_DATABASE_URL` = `postgresql://haccp:haccp@localhost:5432/haccp`, `REDIS_URL=redis://localhost:6379`, plus `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` (non-empty, or the API refuses to boot — see env validation in `apps/api/src/env.ts`).
  - `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.

- **Clerk auth requires real keys for any user-facing flow.** Both apps use Clerk (`apps/web/src/app/[locale]/layout.tsx` `ClerkProvider`, `apps/web/src/proxy.ts` `clerkMiddleware`, API `verifyToken` in `apps/api/src/core/middleware/auth.ts`). Placeholder publishable keys let the servers boot, migrations run, and the API `/health` + Swagger work, but the web sign-in page will show a Clerk "Invalid host" error and no authenticated endpoint (everything except `/health` and the docs is behind `requireAuth`) can be exercised. To test real sign-in / org / locations / tasks flows, set genuine Clerk dev keys (`clerk env pull` from a real Clerk instance) in the env files above.

- **Node.js 24+** is required (matches CI). Use `@types/node@^24` in app packages.

- **Sentry is disabled locally** (only enabled when `VERCEL_ENV === "production"`); no DSN needed for dev.
