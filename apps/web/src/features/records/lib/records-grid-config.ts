import { GRID_DEFAULT_PAGE_SIZE, SORT_ORDER } from "@haccp/shared";
import { normalizeGridFilters } from "@/components/ui/data-table/server-grid/grid-request";
import type {
  GridCapabilities,
  GridFilterState,
  GridRequest,
} from "@/components/ui/data-table/server-grid/types";

export type RecordsDateRange = { dateFrom: string; dateTo: string };

export const RECORDS_PAGE_SIZE = GRID_DEFAULT_PAGE_SIZE;

/** Newest first: the latest exceptions are what an admin opens the page for. */
export const RECORDS_LIST_SORT = {
  sortBy: "entryAt",
  sortOrder: SORT_ORDER.DESC,
} as const;

/** Module-level so `useServerDataGrid` memoises against a stable reference. */
export const RECORDS_GRID_CAPABILITIES: GridCapabilities = {
  pagination: true,
  sorting: true,
  filtering: true,
  search: true,
  selection: false,
  columnVisibility: false,
};

/** The date range is required scope, so it is prepended to the grid's own query string. */
export function recordsGridQueryString(
  range: RecordsDateRange,
  gridQueryString: string,
): string {
  const params = rangeParams(range).toString();
  return gridQueryString === "" ? params : `${params}&${gridQueryString}`;
}

/** Location, range, filter, sort and page all change the rows behind an open record. */
export function recordsDatasetKey(input: {
  locationId: string;
  range: RecordsDateRange;
  request: GridRequest;
}): string {
  return JSON.stringify([
    input.locationId,
    input.range.dateFrom,
    input.range.dateTo,
    input.request,
  ]);
}

function rangeParams(range: RecordsDateRange): URLSearchParams {
  return new URLSearchParams({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  });
}

function appendFilters(params: URLSearchParams, filters: GridFilterState) {
  for (const [key, values] of Object.entries(
    normalizeGridFilters(filters) ?? {},
  )) {
    params.set(key, values.join(","));
  }
}

/** Everything but the page: the phone's "Show more" appends to one infinite query per value. */
export function recordsListBaseQuery(input: {
  range: RecordsDateRange;
  filters: GridFilterState;
  search?: string;
}): string {
  const params = rangeParams(input.range);
  params.set("sortBy", RECORDS_LIST_SORT.sortBy);
  params.set("sortOrder", RECORDS_LIST_SORT.sortOrder);
  appendFilters(params, input.filters);
  const search = input.search?.trim() ?? "";
  if (search !== "") params.set("search", search);
  return params.toString();
}

export function recordsPageQueryString(baseQuery: string, page: number): string {
  return `${baseQuery}&page=${page}&pageSize=${RECORDS_PAGE_SIZE}`;
}

/** What the server render fetches; the client's first page must ask exactly this to reuse it. */
export function defaultRecordsQueryString(range: RecordsDateRange): string {
  return recordsPageQueryString(
    recordsListBaseQuery({ range, filters: {} }),
    1,
  );
}

/** The SSR page answers only the server-rendered location and the unfiltered initial range. */
export function shouldSeedRecordsPage(input: {
  locationId: string;
  initialLocationId: string;
  baseQuery: string;
  initialBaseQuery: string;
}): boolean {
  return (
    input.locationId === input.initialLocationId &&
    input.baseQuery === input.initialBaseQuery
  );
}
