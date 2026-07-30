# HACCP System

Monorepo skeleton for a HACCP (Hazard Analysis and Critical Control Points) management platform.

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Web:** Next.js (App Router) in `apps/web`
- **API:** Hono REST API in `apps/api` (mobile-ready)
- **Shared:** `@haccp/shared` types and Zod schemas

## Prerequisites

- Node.js 20+
- pnpm 10+

## Getting started

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health

Copy environment examples before running locally:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Start local Postgres and Redis (overrides remote URLs via `apps/api/.env.local`):

```bash
pnpm docker:up
pnpm db:migrate
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web and API in development |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm format` | Format with Prettier |

## Project structure

```
apps/
  web/     Next.js frontend
  api/     Standalone REST API (Hono)
packages/
  shared/            Shared types and Zod schemas
  typescript-config/ Shared TypeScript configs
  eslint-config/     Shared ESLint configs
```

## Future HACCP modules

Planned domain areas to implement in `apps/web/src/features/` and `apps/api/src/routes/`:

- Hazards
- CCP (Critical Control Points)
- Monitoring
- Corrective actions
- Documentation
- Audits

## Push to remote

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

## Next steps

- Database (Drizzle or Prisma)
- Authentication (e.g. Clerk)
- OpenAPI documentation for mobile clients
- shadcn/ui component library
- CI/CD pipeline
