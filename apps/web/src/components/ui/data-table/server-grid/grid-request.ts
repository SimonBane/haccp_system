import { GRID_DEFAULT_PAGE_SIZE, SORT_ORDER } from "@haccp/shared";
import {
  DEFAULT_GRID_CAPABILITIES,
  type GridCapabilities,
  type GridDefaultSort,
  type GridFilterState,
  type GridRequest,
  type GridSortState,
} from "./types";

export function resolveGridCapabilities(
  overrides?: Partial<GridCapabilities>,
): GridCapabilities {
  return { ...DEFAULT_GRID_CAPABILITIES, ...overrides };
}

/**
 * Drops empty selections, deduplicates and sorts, so two logically identical
 * filter states produce one request — and therefore one React Query cache entry.
 */
export function normalizeGridFilters(
  filters: GridFilterState,
): Record<string, string[]> | undefined {
  const entries = Object.keys(filters)
    .sort()
    .flatMap((key) => {
      const values = [...new Set(filters[key] ?? [])].sort();
      return values.length > 0 ? ([[key, values]] as [string, string[]][]) : [];
    });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export type BuildGridRequestInput = {
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: GridSortState;
  filters: GridFilterState;
  capabilities: GridCapabilities;
  defaultSort?: GridDefaultSort;
};

/**
 * Turns UI state into the shared API query. TanStack counts pages from zero and
 * the API from one; this boundary is the only place that conversion happens.
 */
export function buildGridRequest(input: BuildGridRequestInput): GridRequest {
  const request: GridRequest = {};

  if (input.capabilities.pagination) {
    const pageSize = input.pageSize || GRID_DEFAULT_PAGE_SIZE;
    request.page = Math.max(0, input.pageIndex) + 1;
    request.pageSize = pageSize;
  }

  if (input.capabilities.search) {
    const search = input.search.trim();
    if (search !== "") {
      request.search = search;
    }
  }

  if (input.capabilities.sorting) {
    const sorting = input.sorting
      ? {
          sortBy: input.sorting.id,
          sortOrder: input.sorting.desc ? SORT_ORDER.DESC : SORT_ORDER.ASC,
        }
      : input.defaultSort;

    if (sorting) {
      request.sortBy = sorting.sortBy;
      request.sortOrder = sorting.sortOrder;
    }
  }

  if (input.capabilities.filtering) {
    const filters = normalizeGridFilters(input.filters);
    if (filters) {
      request.filters = filters;
    }
  }

  return request;
}

/** Multi-select filters travel as one comma-separated parameter per key. */
export function gridRequestToQueryString(request: GridRequest): string {
  const params = new URLSearchParams();

  if (request.page !== undefined && request.pageSize !== undefined) {
    params.set("page", String(request.page));
    params.set("pageSize", String(request.pageSize));
  }

  if (request.search) {
    params.set("search", request.search);
  }

  if (request.sortBy) {
    params.set("sortBy", request.sortBy);
    params.set("sortOrder", request.sortOrder ?? SORT_ORDER.ASC);
  }

  for (const [key, values] of Object.entries(request.filters ?? {})) {
    if (values.length > 0) {
      params.set(key, values.join(","));
    }
  }

  return params.toString();
}

export function sameGridRequest(a: GridRequest, b: GridRequest): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Query keys are `[...root, "list", request]`; only the request varies inside one
 * organization/location, so everything before it identifies the scope.
 */
export function sameGridScope(
  a: readonly unknown[] | undefined,
  b: readonly unknown[],
): boolean {
  if (!a || a.length !== b.length) {
    return false;
  }

  return a.slice(0, -1).every((part, index) => part === b[index]);
}

/**
 * The SSR payload answers exactly one question. Seeding it under a different
 * organization/location, or for anything but the default request, would show rows
 * that were never asked for.
 */
export function shouldSeedInitialData(input: {
  scopeKey: string;
  initialScopeKey?: string;
  request: GridRequest;
  defaultRequest: GridRequest;
  hasInitialPage: boolean;
}): boolean {
  return (
    input.hasInitialPage &&
    input.initialScopeKey === input.scopeKey &&
    sameGridRequest(input.request, input.defaultRequest)
  );
}
