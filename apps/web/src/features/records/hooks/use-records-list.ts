"use client";

import {
  recordsListResponseSchema,
  type FormVersionSummaryMap,
  type RecordItem,
  type RecordsListResponse,
} from "@haccp/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import {
  RECORDS_PAGE_SIZE,
  recordsListBaseQuery,
  recordsPageQueryString,
  shouldSeedRecordsPage,
  type RecordsDateRange,
} from "@/features/records/lib/records-grid-config";

export type UseRecordsListOptions = {
  initialPage: RecordsListResponse;
  initialLocationId: string;
  initialRange: RecordsDateRange;
  range: RecordsDateRange;
  enabled: boolean;
};

/** The phone's list: every page loaded so far, grown by "Show more". */
export function useRecordsList(options: UseRecordsListOptions) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const { range } = options;

  const baseQuery = useMemo(
    () => recordsListBaseQuery({ range, filters: {} }),
    [range],
  );
  const initialBaseQuery = useMemo(
    () => recordsListBaseQuery({ range: options.initialRange, filters: {} }),
    [options.initialRange],
  );
  const seeded = shouldSeedRecordsPage({
    locationId,
    initialLocationId: options.initialLocationId,
    baseQuery,
    initialBaseQuery,
  });

  const query = useInfiniteQuery({
    queryKey: queryKeys.recordsList(locationId, baseQuery),
    queryFn: ({ pageParam, signal }) =>
      fetchJson(
        `${locationScopedPath(locationId, "records")}?${recordsPageQueryString(baseQuery, pageParam)}`,
        recordsListResponseSchema,
        { signal },
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      pages.length * RECORDS_PAGE_SIZE < lastPage.total
        ? pages.length + 1
        : undefined,
    initialData: seeded
      ? { pages: [options.initialPage], pageParams: [1] }
      : undefined,
    // Keeps the last rows on screen while a new range loads, never another location's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === locationId ? previous : undefined,
    enabled: options.enabled,
  });

  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const formVersions = useMemo<FormVersionSummaryMap>(
    () => Object.assign({}, ...pages.map((page) => page.formVersions)),
    [pages],
  );
  const items = useMemo<RecordItem[]>(
    () => pages.flatMap((page) => page.items),
    [pages],
  );

  return {
    items,
    formVersions,
    showMore: () => void query.fetchNextPage(),
    hasMore: Boolean(query.hasNextPage),
    isFetchingMore: query.isFetchingNextPage,
    isPending: query.isPending,
    isError: query.isError && pages.length === 0,
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
    /** Changes whenever the rows behind an open record could be different ones. */
    datasetKey: `${locationId}|${baseQuery}`,
  };
}
