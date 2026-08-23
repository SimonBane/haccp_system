import { SORT_ORDER } from "@haccp/shared";
import type { GridDefaultSort, GridFilterState, GridSortState } from "./types";
import { clampPageIndex } from "./grid-pagination";

export type ServerGridState = {
  scopeKey: string;
  pageIndex: number;
  pageSize: number;
  searchDraft: string;
  search: string;
  sorting: GridSortState;
  filters: GridFilterState;
  rowSelection: Record<string, boolean>;
};

export type ServerGridInit = {
  scopeKey: string;
  pageSize: number;
  defaultSort?: GridDefaultSort;
};

export type ServerGridAction =
  | { type: "setSearchDraft"; search: string }
  | { type: "setPageIndex"; pageIndex: number }
  | { type: "setPageSize"; pageSize: number }
  | { type: "commitSearch"; search: string }
  | { type: "setSorting"; sorting: GridSortState }
  | { type: "setFilter"; key: string; values: string[] }
  | { type: "clearFilters" }
  | { type: "setRowSelection"; rowSelection: Record<string, boolean> }
  | { type: "clearSelection" }
  | { type: "resetScope"; init: ServerGridInit }
  | { type: "clampToLastPage"; total: number };

export function initialServerGridState(init: ServerGridInit): ServerGridState {
  return {
    scopeKey: init.scopeKey,
    pageIndex: 0,
    pageSize: init.pageSize,
    searchDraft: "",
    search: "",
    sorting: init.defaultSort
      ? { id: init.defaultSort.sortBy, desc: init.defaultSort.sortOrder === SORT_ORDER.DESC }
      : null,
    filters: {},
    rowSelection: {},
  };
}

const NO_SELECTION: Record<string, boolean> = {};

function withoutSelection(state: ServerGridState): ServerGridState {
  return Object.keys(state.rowSelection).length === 0
    ? state
    : { ...state, rowSelection: NO_SELECTION };
}

function sameSorting(a: GridSortState, b: GridSortState): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.id === b.id && a.desc === b.desc;
}

export function serverGridReducer(
  state: ServerGridState,
  action: ServerGridAction,
): ServerGridState {
  switch (action.type) {
    case "setPageIndex": {
      if (action.pageIndex === state.pageIndex) {
        return state;
      }

      return {
        ...withoutSelection(state),
        pageIndex: Math.max(0, action.pageIndex),
      };
    }

    case "setPageSize": {
      if (action.pageSize === state.pageSize) {
        return state;
      }

      return {
        ...withoutSelection(state),
        pageSize: action.pageSize,
        pageIndex: 0,
      };
    }

    case "setSearchDraft":
      return action.search === state.searchDraft
        ? state
        : { ...state, searchDraft: action.search };

    case "commitSearch": {
      if (action.search === state.search) {
        return state;
      }

      return {
        ...withoutSelection(state),
        search: action.search,
        pageIndex: 0,
      };
    }

    case "setSorting": {
      if (sameSorting(action.sorting, state.sorting)) {
        return state;
      }

      return {
        ...withoutSelection(state),
        sorting: action.sorting,
        pageIndex: 0,
      };
    }

    case "setFilter": {
      const current = state.filters[action.key] ?? [];
      const next = [...new Set(action.values)].sort();

      if (
        current.length === next.length &&
        current.every((value, index) => value === next[index])
      ) {
        return state;
      }

      const filters = { ...state.filters };
      if (next.length === 0) {
        delete filters[action.key];
      } else {
        filters[action.key] = next;
      }

      return { ...withoutSelection(state), filters, pageIndex: 0 };
    }

    case "clearFilters": {
      if (Object.keys(state.filters).length === 0) {
        return state;
      }

      return { ...withoutSelection(state), filters: {}, pageIndex: 0 };
    }

    case "setRowSelection":
      return { ...state, rowSelection: action.rowSelection };

    case "clearSelection":
      return withoutSelection(state);

    case "resetScope":
      return initialServerGridState(action.init);

    case "clampToLastPage": {
      const pageIndex = clampPageIndex(
        state.pageIndex,
        action.total,
        state.pageSize,
      );

      if (pageIndex === state.pageIndex) {
        return state;
      }

      return { ...withoutSelection(state), pageIndex };
    }
  }
}

export function hasActiveGridQuery(state: ServerGridState): boolean {
  return (
    state.search.trim() !== "" ||
    Object.values(state.filters).some((values) => values.length > 0)
  );
}

export function selectedRowIds(
  rowSelection: Record<string, boolean>,
  pageRowIds: readonly string[],
): string[] {
  const onPage = new Set(pageRowIds);
  return Object.keys(rowSelection).filter(
    (id) => rowSelection[id] && onPage.has(id),
  );
}
