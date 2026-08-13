#!/bin/bash
set -euo pipefail

# Only meaningful in Claude Code on the web — a local `claude` session already
# has its own node_modules, env files and Docker setup managed by the developer.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "Installing workspace dependencies..."
pnpm install

# @haccp/shared is consumed from dist/ by both apps. Turbo's `^build` handles
# this automatically for `pnpm build|lint|typecheck|test`, but a directly
# invoked `tsc` or `vitest` inside an app does not get that dependency, so
# leave a fresh build in place proactively.
echo "Building @haccp/shared..."
pnpm --filter @haccp/shared build

# Placeholder env files so `pnpm dev` and `db:*` scripts can boot instead of
# crashing at startup validation (apps/api/src/env.ts requires all of these to
# be non-empty). Non-destructive: never overwrites files that already exist,
# so real credentials placed here by the developer are left alone.
#
# These placeholders are enough to boot the API process and serve Swagger in
# development, but NOT enough to reach a real Postgres/Redis or exercise any
# authenticated flow — see AGENTS.md and CLAUDE.md's "Environment setup" for
# what real values are needed and why. This environment's egress policy also
# blocks Docker Hub image pulls, so `pnpm docker:up` will not work here;
# integration testing against a real database needs hosted credentials
# (Supabase / Redis Cloud) in apps/api/.env.local instead.
if [ ! -f apps/api/.env ]; then
  cat > apps/api/.env << 'ENV'
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://haccp:haccp@localhost:5432/haccp
DIRECT_DATABASE_URL=postgresql://haccp:haccp@localhost:5432/haccp
NODE_ENV=development
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_placeholder
CLERK_PUBLISHABLE_KEY=pk_test_placeholder
WEB_APP_URL=http://localhost:3000
ENV
fi

if [ ! -f apps/api/.env.local ]; then
  touch apps/api/.env.local
fi

if [ ! -f apps/web/.env.local ]; then
  cat > apps/web/.env.local << 'ENV'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
ENV
fi

echo "Session start hook complete."
