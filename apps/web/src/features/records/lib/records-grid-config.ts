import { GRID_DEFAULT_PAGE_SIZE, RECORDS_DEFAULT_SORT } from "@haccp/shared";
import {
  buildGridRequest,
  gridRequestToQueryString,
  resolveGridCapabilities,
} from "@/components/ui/data-table/server-grid/grid-request";
import type {
  GridCapabilities,
  GridRequest,
} from "@/components/ui/data-table/server-grid/types";

/** Module-level so `useServerDataGrid` memoises against a stable reference. */
export const RECORDS_GRID_CAPABILITIES: GridCapabilities = {
  pagination: true,
  sorting: true,
  filtering: true,
  search: false,
  selection: false,
  columnVisibility: false,
};

/**
 * The request the controller builds on its first render. The server render must send
 * exactly this, or `initialData` is discarded and the page refetches on hydration.
 */
export function defaultRecordsGridRequest(): GridRequest {
  return buildGridRequest({
    pageIndex: 0,
    pageSize: GRID_DEFAULT_PAGE_SIZE,
    search: "",
    sorting: null,
    filters: {},
    capabilities: resolveGridCapabilities(RECORDS_GRID_CAPABILITIES),
    defaultSort: RECORDS_DEFAULT_SORT,
  });
}

export type RecordsDateRange = { dateFrom: string; dateTo: string };

/** The date range is required scope, so it is prepended to the harness query string. */
export function recordsQueryString(
  range: RecordsDateRange,
  gridQueryString: string,
): string {
  const params = new URLSearchParams({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  });

  return gridQueryString === ""
    ? params.toString()
    : `${params.toString()}&${gridQueryString}`;
}

export function defaultRecordsQueryString(range: RecordsDateRange): string {
  return recordsQueryString(
    range,
    gridRequestToQueryString(defaultRecordsGridRequest()),
  );
}

/**
 * The SSR payload answers the server-rendered range only. Once the user moves the
 * range, seeding it would show the old range's rows under the new one.
 */
export function shouldSeedRecordsPage(input: {
  range: RecordsDateRange;
  initialRange: RecordsDateRange;
}): boolean {
  return (
    input.range.dateFrom === input.initialRange.dateFrom &&
    input.range.dateTo === input.initialRange.dateTo
  );
}

/**
 * Identifies the dataset currently on screen. Location, range, filter, sort, page and
 * page-size changes all produce a new key, which is what dismisses an open detail.
 */
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
