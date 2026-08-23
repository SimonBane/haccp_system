# Data grids

One `DataTable`, two execution modes.

- **Client mode** — the component receives the complete array and TanStack filters,
  sorts and paginates it. This is what every current grid (equipment, task
  templates, employees, locations) uses today, unchanged.
- **Server mode** — the component receives one page plus the server `total`, and
  TanStack is told not to process it again (`manualPagination`, `manualSorting`,
  `manualFiltering`, `rowCount`). This mode is a reusable harness only: no current
  page passes server config, so it is dormant until a follow-up task connects it to
  a real endpoint.

Both modes render the same toolbar, search box, sort headers, desktop table, mobile
card list, pagination, selection and column visibility. There is no second grid
component — adding server-side paging to a grid later should never require
inventing a parallel `ServerDataTable`.

## Client mode (current, unchanged)

```tsx
<DataTable
  columns={columns}
  data={items}
  enableSearch
  searchColumn="name"
  enablePagination={false}
  emptyMessage={t("emptyTitle")}
  noResultsMessage={tTable("noResults")}
/>
```

`searchColumn` names the column the search box filters. Everything else is default
TanStack behaviour, exactly as before this harness existed.

## Server mode (illustrative — not wired to any endpoint)

The example below is hypothetical. There is no `widgets` resource, route,
repository or `useWidgetsGrid` hook in this codebase — it exists only to show how
a future feature would plug into the harness.

```tsx
const grid = useWidgetsGrid({ initialPage, initialLocationId });

<DataTable
  columns={columns}
  data={grid.items}
  enableSearch
  enablePagination
  pageSizeOptions={GRID_PAGE_SIZE_OPTIONS}
  enableRowSelection
  enableColumnVisibility
  getRowId={(row) => row.id}
  server={grid.server}
/>;
```

`grid.server` (a `DataTableServerConfig`) carries the controlled pagination,
sorting, search, filter and selection state plus the server `rowCount`. Passing it
is what switches `DataTable` into server mode.

## Adopting server mode for a real grid (future work)

None of the following exists yet. This is the checklist a follow-up task should
work through to connect one production grid to server-side paging.

### 1. Shared schema

In `packages/shared/src/schemas/<resource>.ts`, build the page response from the
generic factory and declare the sort allowlist:

```ts
export const widgetListResponseSchema = createGridPageSchema(widgetResponseSchema);

export const WIDGET_SORT_FIELDS = ["name", "status"] as const;
export const WIDGET_DEFAULT_SORT = { sortBy: "name", sortOrder: SORT_ORDER.ASC } as const;

export const widgetListQuerySchema = createGridQuerySchema({
  sortFields: WIDGET_SORT_FIELDS,
  // Optional; omit until the grid actually offers a filter.
  filters: { status: createGridFilterSchema(["draft", "active"] as const) },
});
```

Re-export every new name from `packages/shared/src/index.ts` — the barrel is
explicit, not `export *`. `createGridQuerySchema` is strict: unknown parameters, an
unlisted sort field, an invalid direction, incomplete paging, or a filter value
outside the allowlist are all validation failures the endpoint must reject.

### 2. Repository, route and service

None of this exists today — no route accepts `page`/`pageSize`/`sortBy`, no
repository builds a SQL count alongside the page query. Building it means:

- one shared predicate for the page query and the count query, so `total` can never
  disagree with the rows;
- an explicit map from each allowlisted `sortBy` value to a SQL sort term — never a
  client-supplied identifier interpolated into SQL;
- an id tie-breaker appended to every ordering, or paging can repeat and drop rows;
- validating the query against `widgetListQuerySchema` in the route and passing the
  parsed result to the service, which maps only the returned page and returns
  `{ items, total }`.

### 3. Feature fetcher and query keys

Query keys need two levels. The **root** is the scope and the invalidation prefix;
the **list** key adds the normalized request so each page/sort/filter combination
caches independently:

```ts
widgets: (locationId: string) => ["widgets", locationId] as const,
widgetsList: (locationId: string, request: GridRequest) =>
  ["widgets", locationId, "list", request] as const,
```

Mutations invalidate the root, which covers every cached page and query variant in
that scope. Never invalidate a single page key.

### 4. Controller

```ts
export function useWidgetsGrid(options?: {
  initialPage?: WidgetListResponse;
  initialLocationId?: string;
}) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  return useServerDataGrid({
    scopeKey: locationId,
    queryKeyRoot: queryKeys.widgets(locationId),
    defaultSort: WIDGET_DEFAULT_SORT,
    defaultPageSize: GRID_DEFAULT_PAGE_SIZE,
    capabilities: { selection: true, columnVisibility: true },
    initialPage: options?.initialPage,
    initialScopeKey: options?.initialLocationId,
    getRowId: (item) => item.id,
    fetcher: ({ queryString, signal }) =>
      fetchJson(`/locations/${locationId}/widgets?${queryString}`, widgetListResponseSchema, {
        signal,
      }),
  });
}
```

`useServerDataGrid` (`server-grid/use-server-data-grid.ts`) owns everything the
feature should not re-decide:

- zero-based UI page index converted to the API's one-based `page`
  (`server-grid/grid-request.ts`);
- committed search debounced by 350 ms, with a clear committing immediately
  (`server-grid/use-search-committer.ts`);
- a reset to page one after any search, filter, sorting or page-size change
  (`server-grid/grid-reducer.ts`);
- a full reset of query **and** selection when `scopeKey` changes, computed during
  render so the previous scope's page is never requested or shown;
- `initialData` seeded only when the scope and the request both match the
  server-rendered default request;
- previous-page rows kept as placeholder data within one scope and refused across
  scopes;
- the request's `AbortSignal` handed to the fetch;
- a clamp back to the last valid page when a delete empties the one on screen.

### 5. Server render

A future SSR page would fetch the same default request the controller builds (page
1, the resource's default sort, no search/filters) and pass the whole `GridPage` —
not just `items` — as `initialPage`, so the client's first request can seed from it
instead of discarding it on hydration.

### 6. Columns

TanStack column ids must match the endpoint's sort-field names exactly, or the
header will ask the server to sort by something it does not accept. Action and
select columns stay `enableSorting: false`.

### 7. Capabilities

Each capability is opt-in per grid: `search`, `sorting`, `pagination`, `filtering`,
`selection`, `columnVisibility`. A disabled capability contributes nothing to the
request, so it cannot change the cache key either.

### 8. Filters

Filters are declarative. A definition supplies the API key, a translated label and
the canonical option values:

```ts
const filters: DataTableFilterDefinition[] = [
  {
    key: "type",
    label: t("columns.type"),
    options: EQUIPMENT_TYPE_ORDER.map((value) => ({ value, label: typeLabels[value] })),
  },
];
```

Pass `filters={filters}` to `DataTable` and enable the `filtering` capability. Values
within one filter are ORed, different filters are ANDed, and the controller
serializes them as one comma-separated parameter per key. Client mode applies the
same definitions through TanStack column filters. Every new generic string belongs in
both `messages/en.json` and `messages/bg.json`.

### 9. Selection

Selection is deliberately page-scoped. Row ids must be stable (`getRowId`), the
header checkbox selects only the visible page, and the controller drops the whole
selection on a page, page-size, search, filter, sorting or scope change — and after a
refetch that removes a selected row. Bulk actions would read `grid.selectedIds`,
which is already intersected with the rendered page.

### 10. Tests

- Pure controller logic — request building, filter serialization, the reducer, the
  debounce, clamping — belongs in the Node Vitest suites next to these files. No DOM
  environment.
- Endpoint behaviour belongs in `apps/api/tests/integration`, against real Postgres
  and Redis.
- Journeys that only a browser can prove (page transitions, scope switches, selection
  clearing) belong in the Playwright smoke suite.

None of these adoption tests exist yet, because no grid has adopted server mode.
This harness's own tests (below) cover only the dormant, generic behaviour.

## Reference

| Piece | File |
| --- | --- |
| Shared contract (`GridPage`, `createGridQuerySchema`, `createGridFilterSchema`, `SORT_ORDER`) | `packages/shared/src/schemas/grid.ts` |
| `DataTable` server config | `data-table.tsx` |
| Server-aware pagination | `data-table-pagination.tsx` |
| Server-aware search | `data-table-search.tsx` |
| Request building | `server-grid/grid-request.ts` |
| Page-count math | `server-grid/grid-pagination.ts` |
| State machine | `server-grid/grid-reducer.ts` |
| Search debounce | `server-grid/grid-search.ts`, `server-grid/use-search-committer.ts` |
| Client/server mode derivation | `server-grid/grid-mode.ts` |
| Controller | `server-grid/use-server-data-grid.ts` |
| Filter controls | `data-table-filter.tsx` |
