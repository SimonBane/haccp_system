"use client";

import {
  GRID_DEFAULT_PAGE_SIZE,
  RECORDS_DEFAULT_SORT,
  recordsListResponseSchema,
  type RecordItem,
  type RecordsListResponse,
} from "@haccp/shared";
import { useCallback, useMemo, useState } from "react";
import type { DataTableServerConfig } from "@/components/ui/data-table/server-grid/types";
import { useServerDataGrid } from "@/components/ui/data-table/server-grid/use-server-data-grid";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import {
  isSameRecordsRange,
  recordsRangeError,
} from "@/features/records/lib/date-range";
import {
  isTemperatureResultFilterVisible,
  RECORDS_FILTER_KEY,
  shouldClearResultFilter,
} from "@/features/records/lib/records-filters";
import {
  RECORDS_GRID_CAPABILITIES,
  recordsDatasetKey,
  recordsQueryString,
  shouldSeedRecordsPage,
  type RecordsDateRange,
} from "@/features/records/lib/records-grid-config";

export type UseRecordsGridOptions = {
  initialPage: RecordsListResponse;
  initialLocationId: string;
  initialRange: RecordsDateRange;
  /** Organization-local today, resolved on the server; future dates are rejected against it. */
  today: string;
};

export type RecordsGrid = {
  items: RecordItem[];
  total: number;
  range: RecordsDateRange;
  setRange: (range: RecordsDateRange) => void;
  server: DataTableServerConfig;
  showResultFilter: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
  /** Bumps whenever the visible dataset changes, so open detail can be dismissed. */
  datasetKey: string;
};

export function useRecordsGrid(options: UseRecordsGridOptions): RecordsGrid {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const [range, setRangeState] = useState<RecordsDateRange>(
    options.initialRange,
  );

  const queryKeyRoot = useMemo(
    () => queryKeys.recordsRange(locationId, range.dateFrom, range.dateTo),
    [locationId, range.dateFrom, range.dateTo],
  );

  const fetcher = useCallback(
    ({ queryString, signal }: { queryString: string; signal: AbortSignal }) =>
      fetchJson(
        `${locationScopedPath(locationId, "records")}?${recordsQueryString(range, queryString)}`,
        recordsListResponseSchema,
        { signal },
      ),
    [fetchJson, locationId, range],
  );

  const grid = useServerDataGrid<RecordItem, RecordsListResponse>({
    scopeKey: locationId,
    queryKeyRoot,
    defaultSort: RECORDS_DEFAULT_SORT,
    defaultPageSize: GRID_DEFAULT_PAGE_SIZE,
    capabilities: RECORDS_GRID_CAPABILITIES,
    getRowId: (item) => item.occurrenceId,
    // Seeding is additionally gated on the range: the SSR payload answers the initial range only.
    initialPage: shouldSeedRecordsPage({
      range,
      initialRange: options.initialRange,
    })
      ? options.initialPage
      : undefined,
    initialScopeKey: options.initialLocationId,
    fetcher,
  });

  const { onFilterChange, onPaginationChange, filters, pagination } =
    grid.server;

  const showResultFilter = isTemperatureResultFilterVisible(
    filters[RECORDS_FILTER_KEY.TYPE],
  );

  const handleFilterChange = useCallback(
    (key: string, values: string[]) => {
      onFilterChange(key, values);

      // Both dispatches land in one commit, so only the final state reaches a request.
      if (
        shouldClearResultFilter({
          key,
          values,
          currentResult: filters[RECORDS_FILTER_KEY.RESULT],
        })
      ) {
        onFilterChange(RECORDS_FILTER_KEY.RESULT, []);
      }
    },
    [filters, onFilterChange],
  );

  const setRange = useCallback(
    (next: RecordsDateRange) => {
      if (recordsRangeError(next, options.today)) {
        return;
      }

      setRangeState((current) =>
        isSameRecordsRange(current, next) ? current : next,
      );
      // Filters and sort survive a range change; the page number cannot.
      onPaginationChange({ pageIndex: 0, pageSize: pagination.pageSize });
    },
    [onPaginationChange, options.today, pagination.pageSize],
  );

  const server = useMemo<DataTableServerConfig>(
    () => ({ ...grid.server, onFilterChange: handleFilterChange }),
    [grid.server, handleFilterChange],
  );

  const datasetKey = useMemo(
    () => recordsDatasetKey({ locationId, range, request: grid.request }),
    [locationId, range, grid.request],
  );

  return {
    items: grid.items,
    total: grid.total,
    range,
    setRange,
    server,
    showResultFilter,
    isLoading: grid.isLoading,
    isError: grid.isError,
    refetch: grid.refetch,
    datasetKey,
  };
}
