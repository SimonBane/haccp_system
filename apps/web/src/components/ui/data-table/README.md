# Data grids

One `DataTable`, two execution modes.

- **Client mode** — the component receives the complete array and TanStack filters,
  sorts and paginates it. This is what every current grid (equipment, task
  templates, employees, locations) uses today, unchanged.
- **Server mode** — the component receives one page plus the server `total`, and
  TanStack is told not to process it again (`manualPagination`, `manualSorting`,
  `manualFiltering`, `rowCount`). Records (`features/records`) is the first
  production adoption; everything below still describes the generic harness, not
  Records rules.

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

## Server mode

The `widgets` example below is illustrative — there is no such resource in this
codebase. For the real thing, read `features/records`.

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

## Response metadata beyond `items` and `total`

`useServerDataGrid` is parameterized by the page type as well as the item type:

```ts
useServerDataGrid<RecordItem, RecordsListResponse>({/* … */});
```

`TPage` defaults to `GridPage<TItem>`, so a grid whose endpoint returns exactly
`{ items, total }` passes nothing extra and behaves as before. When the response
type _extends_ `GridPage` with extra fields (an unfiltered count, a summary, ...),
the whole parsed page is exposed as `grid.page`:

```ts
const extra = grid.page?.someExtraField;
```

`items` and `total` remain the convenience fields and are unchanged. `grid.page`
follows the same query as the rows, so it can never disagree with them, and it is
`undefined` outside the current scope — placeholder data is refused across a scope
change (`sameGridScope`), which is what keeps one location's or date range's
metadata from surfacing under another. Recovering extra metadata with a second
query, a callback or a side channel is what this seam exists to avoid.

## Adopting server mode for a real grid

`features/records` works through this checklist end to end; use it as the worked
example.

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

`apps/api/src/modules/records` is the reference. Building one means:

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

The SSR page fetches the same default request the controller builds (page 1, the
resource's default sort, no search/filters) and passes the whole `GridPage` — not
just `items` — as `initialPage`, so the first client render seeds from it instead of
discarding it on hydration. Records shares one `defaultRecordsGridRequest()` between
the page and the controller so the two requests are byte-identical.

### 6. Columns

TanStack column ids must match the endpoint's sort-field names exactly, or the
header will ask the server to sort by something it does not accept. Action and
select columns stay `enableSorting: false`.

### 7. Capabilities

Each capability is opt-in per grid: `search`, `sorting`, `pagination`, `filtering`,
`selection`, `columnVisibility`. A disabled capability contributes nothing to the
request, so it cannot change the cache key either.

### 8. Search

`createGridQuerySchema({ …, search: false })` drops the `search` key from the
strict query object, so a grid with the `search` capability disabled rejects the
parameter as unknown rather than silently accepting it.

### 9. Filters

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

### 10. Selection

Selection is deliberately page-scoped. Row ids must be stable (`getRowId`), the
header checkbox selects only the visible page, and the controller drops the whole
selection on a page, page-size, search, filter, sorting or scope change — and after a
refetch that removes a selected row. Bulk actions would read `grid.selectedIds`,
which is already intersected with the rendered page.

### 11. Tests

- Pure controller logic — request building, filter serialization, the reducer, the
  debounce, clamping — belongs in the Node Vitest suites next to these files. No DOM
  environment.
- Endpoint behaviour belongs in `apps/api/tests/integration`, against real Postgres
  and Redis.
- Journeys that only a browser can prove (page transitions, scope switches, selection
  clearing) belong in the Playwright smoke suite.

Records carries all three layers: `packages/shared/src/schemas/records.test.ts`
and `apps/api/src/modules/records/*.test.ts` for the contract and query
composition, `apps/api/tests/integration/records.integration.test.ts` for the
endpoint, `apps/web/src/features/records/lib/*.test.ts` for the feature's own
composition, and `e2e/tests/records/` for the browser journey. The metadata seam's
own generic coverage is in `server-grid/grid-metadata.test.ts`.

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
| Controller and the `page` metadata seam | `server-grid/use-server-data-grid.ts` |
| Filter controls | `data-table-filter.tsx` |
