# Feature Module Convention

Domain code lives in `src/features/<name>/`. Each feature is a self-contained module with a predictable layout.

## Structure

```
features/<name>/
  <name>-manager.tsx       # list/admin orchestrator (optional)
  <name>-view.tsx          # page-level orchestrator (optional)
  <name>-form.tsx          # create/edit form (optional)
  components/              # presentational UI
  hooks/                   # React Query hooks and feature hooks
  lib/                     # pure utils, formatters, grouping logic
  data-table/              # list views only
    columns.tsx
    data.tsx
    row-actions.tsx
```

**Rules**

- One orchestrator file at the feature root (`*-manager.tsx` or `*-view.tsx`)
- Create `components/`, `hooks/`, or `lib/` only when they contain files — no empty scaffold folders
- No barrel `index.ts` exports — import directly, e.g. `@/features/today/components/today-header`
- API types and Zod schemas live in `@haccp/shared`, not in the web app

## Reference: `equipment`

```
features/equipment/
  equipment-manager.tsx
  equipment-form.tsx
  equipment-page-skeleton.tsx
  hooks/
    use-equipment-query.ts
    use-equipment-mutations.ts
  data-table/
    columns.tsx
    data.tsx
    row-actions.tsx
```

Route: `/dashboard/equipment`

## Reference: `task-templates`

Admin CRUD for recurring task templates.

```
features/task-templates/
  task-templates-manager.tsx
  task-templates-form.tsx
  components/
    scheduled-time-row.tsx
    task-templates-page-skeleton.tsx
  hooks/
    use-task-templates-query.ts
    use-task-templates-mutations.ts
  lib/
    format-schedule.ts
  data-table/
    columns.tsx
    data.tsx
    row-actions.tsx
```

Route: `/dashboard/task-templates`

## Reference: `today`

Daily task completion workflow.

```
features/today/
  today-view.tsx
  components/
    today-header.tsx
    today-overview.tsx
    today-summary.tsx
    today-progress-strip.tsx
    today-section.tsx
    today-task-card.tsx
    today-task-list.tsx
    today-task-workspace.tsx
    today-workspace.tsx
    today-priority-banner.tsx
    today-empty-state.tsx
    today-page-skeleton.tsx
    temperature-check-dialog.tsx
  hooks/
    use-today-query.ts
    use-today-mutations.ts
  lib/
    today-grouping.ts
```

Route: `/dashboard` (Today is the main dashboard view)

## Data Fetching

- **Server:** `src/lib/api/server.ts` — authenticated fetch in Server Components (`cache: "no-store"`)
- **Client queries:** TanStack Query via `use*Query` hooks in `features/*/hooks/`
- **Client mutations:** `use*Mutations` hooks invalidate query keys after writes
- **Query keys:** centralized in `src/lib/api/query-keys.ts`
- **Provider:** `QueryClientProvider` in `src/components/providers/query-provider.tsx`
- Pages fetch initial data on the server and pass as `initialData` to hydrate client queries

## Related Folders

| Folder | Purpose |
|---|---|
| `src/app/` | Routes only — thin pages that compose features |
| `src/components/ui/` | shadcn primitives — no business logic |
| `src/components/layout/` | App shell — sidebar, nav, page headers |
| `src/components/auth/` | Auth-specific UI |
| `src/hooks/` | Shared UI hooks (e.g. `use-mobile`, `use-now`) |
