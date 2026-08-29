"use client";

import { GRID_DEFAULT_PAGE_SIZE, type GridPage } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import type {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  buildGridRequest,
  gridRequestToQueryString,
  resolveGridCapabilities,
  sameGridScope,
  shouldSeedInitialData,
} from "./grid-request";
import { clampPageIndex } from "./grid-pagination";
import {
  hasActiveGridQuery,
  initialServerGridState,
  selectedRowIds,
  serverGridReducer,
  type ServerGridInit,
} from "./grid-reducer";
import {
  type DataTableServerConfig,
  type GridCapabilities,
  type GridDefaultSort,
  type GridRequest,
} from "./types";
import { useSearchCommitter } from "./use-search-committer";

export type ServerGridFetcher<TPage> = (args: {
  request: GridRequest;
  queryString: string;
  signal: AbortSignal;
}) => Promise<TPage>;

export type UseServerDataGridOptions<
  TItem,
  TPage extends GridPage<TItem> = GridPage<TItem>,
> = {
  scopeKey: string;
  queryKeyRoot: readonly unknown[];
  fetcher: ServerGridFetcher<TPage>;
  getRowId: (item: TItem) => string;
  defaultSort?: GridDefaultSort;
  defaultPageSize?: number;
  capabilities?: Partial<GridCapabilities>;
  initialPage?: TPage;
  initialScopeKey?: string;
};

export type ServerDataGrid<
  TItem,
  TPage extends GridPage<TItem> = GridPage<TItem>,
> = {
  items: TItem[];
  total: number;
  /**
   * The whole parsed page for the request currently on screen, so a response type
   * that extends `GridPage` keeps its extra metadata without a second query. It is
   * `undefined` until the first response for this scope arrives.
   */
  page: TPage | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  isPlaceholderData: boolean;
  refetch: () => Promise<unknown>;
  request: GridRequest;
  capabilities: GridCapabilities;
  server: DataTableServerConfig;
  selectedIds: string[];
  clearSelection: () => void;
};

export function useServerDataGrid<
  TItem,
  TPage extends GridPage<TItem> = GridPage<TItem>,
>(
  options: UseServerDataGridOptions<TItem, TPage>,
): ServerDataGrid<TItem, TPage> {
  const capabilities = useMemo(
    () => resolveGridCapabilities(options.capabilities),
    [options.capabilities],
  );

  const init: ServerGridInit = useMemo(
    () => ({
      scopeKey: options.scopeKey,
      pageSize: options.defaultPageSize ?? GRID_DEFAULT_PAGE_SIZE,
      defaultSort: options.defaultSort,
    }),
    [options.scopeKey, options.defaultPageSize, options.defaultSort],
  );

  const [storedState, dispatch] = useReducer(
    serverGridReducer,
    init,
    initialServerGridState,
  );

  // Derived, not awaited: on the first render after a scope switch the stale state
  // must never reach the request, or the previous location's page is requested.
  const isStale = storedState.scopeKey !== options.scopeKey;
  const state = isStale ? initialServerGridState(init) : storedState;

  useEffect(() => {
    if (isStale) {
      dispatch({ type: "resetScope", init });
    }
  }, [isStale, init]);

  const commitSearch = useCallback(
    (search: string) => dispatch({ type: "commitSearch", search }),
    [],
  );

  const pushSearch = useSearchCommitter(commitSearch);

  const onSearchChange = useCallback(
    (value: string) => {
      dispatch({ type: "setSearchDraft", search: value });
      pushSearch(value);
    },
    [pushSearch],
  );

  const request = useMemo(
    () =>
      buildGridRequest({
        pageIndex: state.pageIndex,
        pageSize: state.pageSize,
        search: state.search,
        sorting: state.sorting,
        filters: state.filters,
        capabilities,
        defaultSort: options.defaultSort,
      }),
    [
      state.pageIndex,
      state.pageSize,
      state.search,
      state.sorting,
      state.filters,
      capabilities,
      options.defaultSort,
    ],
  );

  const queryKey = useMemo(
    () => [...options.queryKeyRoot, "list", request] as const,
    [options.queryKeyRoot, request],
  );

  const defaultRequest = useMemo(
    () =>
      buildGridRequest({
        pageIndex: 0,
        pageSize: init.pageSize,
        search: "",
        sorting: null,
        filters: {},
        capabilities,
        defaultSort: options.defaultSort,
      }),
    [init.pageSize, capabilities, options.defaultSort],
  );

  const initialData = shouldSeedInitialData({
    scopeKey: options.scopeKey,
    initialScopeKey: options.initialScopeKey,
    request,
    defaultRequest,
    hasInitialPage: Boolean(options.initialPage),
  })
    ? options.initialPage
    : undefined;

  const { fetcher } = options;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      fetcher({
        request,
        queryString: gridRequestToQueryString(request),
        signal,
      }),
    initialData,
    placeholderData: (previousData, previousQuery) =>
      previousQuery && sameGridScope(previousQuery.queryKey, queryKey)
        ? previousData
        : undefined,
  });

  const total = query.data?.total ?? 0;
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // A delete that empties the last page must not strand the view on it.
  useEffect(() => {
    if (!query.data || query.isPlaceholderData) {
      return;
    }

    if (
      clampPageIndex(state.pageIndex, total, state.pageSize) !== state.pageIndex
    ) {
      dispatch({ type: "clampToLastPage", total });
    }
  }, [
    query.data,
    query.isPlaceholderData,
    state.pageIndex,
    state.pageSize,
    total,
  ]);

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const current = { pageIndex: state.pageIndex, pageSize: state.pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;

      if (next.pageSize !== current.pageSize) {
        dispatch({ type: "setPageSize", pageSize: next.pageSize });
        return;
      }

      dispatch({ type: "setPageIndex", pageIndex: next.pageIndex });
    },
    [state.pageIndex, state.pageSize],
  );

  const sortingState = useMemo<SortingState>(
    () => (state.sorting ? [state.sorting] : []),
    [state.sorting],
  );

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(sortingState) : updater;
      const first = next[0];

      dispatch({
        type: "setSorting",
        sorting: first ? { id: first.id, desc: first.desc } : null,
      });
    },
    [sortingState],
  );

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(state.rowSelection) : updater;
      dispatch({ type: "setRowSelection", rowSelection: next });
    },
    [state.rowSelection],
  );

  const onFilterChange = useCallback(
    (key: string, values: string[]) =>
      dispatch({ type: "setFilter", key, values }),
    [],
  );

  const onClearFilters = useCallback(
    () => dispatch({ type: "clearFilters" }),
    [],
  );

  const clearSelection = useCallback(
    () => dispatch({ type: "clearSelection" }),
    [],
  );

  const { getRowId } = options;
  const pageRowIds = useMemo(() => items.map(getRowId), [items, getRowId]);

  // A refetch that drops a selected row must drop the selection with it.
  const selectedIds = useMemo(
    () => selectedRowIds(state.rowSelection, pageRowIds),
    [state.rowSelection, pageRowIds],
  );

  const server = useMemo<DataTableServerConfig>(
    () => ({
      pagination: { pageIndex: state.pageIndex, pageSize: state.pageSize },
      onPaginationChange,
      sorting: sortingState,
      onSortingChange,
      rowCount: total,
      search: state.searchDraft,
      onSearchChange,
      filters: state.filters,
      onFilterChange,
      onClearFilters,
      rowSelection: state.rowSelection,
      onRowSelectionChange,
      isFetching: query.isFetching,
      isPlaceholderData: query.isPlaceholderData,
      hasActiveQuery: hasActiveGridQuery(state),
    }),
    [
      state,
      onPaginationChange,
      sortingState,
      onSortingChange,
      total,
      onSearchChange,
      onFilterChange,
      onClearFilters,
      onRowSelectionChange,
      query.isFetching,
      query.isPlaceholderData,
    ],
  );

  return {
    items,
    total,
    page: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    refetch: query.refetch,
    request,
    capabilities,
    server,
    selectedIds,
    clearSelection,
  };
}
