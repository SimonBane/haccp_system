"use client";

import {
  recordsListResponseSchema,
  type FormVersionSummaryMap,
  type RecordItem,
  type RecordsListResponse,
} from "@haccp/shared";
import { useCallback, useMemo } from "react";
import { useServerDataGrid } from "@/components/ui/data-table/server-grid/use-server-data-grid";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import { isSameRecordsRange } from "@/features/records/lib/date-range";
import {
  RECORDS_GRID_CAPABILITIES,
  RECORDS_LIST_SORT,
  RECORDS_PAGE_SIZE,
  recordsDatasetKey,
  recordsGridQueryString,
  type RecordsDateRange,
} from "@/features/records/lib/records-grid-config";

const EMPTY_FORM_VERSIONS: FormVersionSummaryMap = {};

export type UseRecordsGridOptions = {
  initialPage: RecordsListResponse;
  initialLocationId: string;
  initialRange: RecordsDateRange;
  range: RecordsDateRange;
  enabled: boolean;
};

/** The desktop table: the shared server grid, with the date range as part of its scope. */
export function useRecordsGrid(options: UseRecordsGridOptions) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const { range } = options;

  // The range belongs to the scope, so a new range starts on page one with no stale rows.
  const queryKeyRoot = useMemo(
    () => queryKeys.recordsGrid(locationId, range.dateFrom, range.dateTo),
    [locationId, range.dateFrom, range.dateTo],
  );

  const fetcher = useCallback(
    ({ queryString, signal }: { queryString: string; signal: AbortSignal }) =>
      fetchJson(
        `${locationScopedPath(locationId, "records")}?${recordsGridQueryString(range, queryString)}`,
        recordsListResponseSchema,
        { signal },
      ),
    [fetchJson, locationId, range],
  );

  const grid = useServerDataGrid<RecordItem, RecordsListResponse>({
    scopeKey: `${locationId}|${range.dateFrom}|${range.dateTo}`,
    queryKeyRoot,
    defaultSort: RECORDS_LIST_SORT,
    defaultPageSize: RECORDS_PAGE_SIZE,
    capabilities: RECORDS_GRID_CAPABILITIES,
    getRowId: (item) => item.id,
    // The server render answers the initial range only.
    initialPage: isSameRecordsRange(range, options.initialRange)
      ? options.initialPage
      : undefined,
    initialScopeKey: `${options.initialLocationId}|${options.initialRange.dateFrom}|${options.initialRange.dateTo}`,
    fetcher,
    enabled: options.enabled,
  });

  return {
    ...grid,
    formVersions: grid.page?.formVersions ?? EMPTY_FORM_VERSIONS,
    datasetKey: recordsDatasetKey({ locationId, range, request: grid.request }),
  };
}

export type RecordsGrid = ReturnType<typeof useRecordsGrid>;
