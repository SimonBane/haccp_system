import { describe, expect, it } from "vitest";
import {
  buildGridRequest,
  gridRequestToQueryString,
  normalizeGridFilters,
  resolveGridCapabilities,
  sameGridRequest,
  sameGridScope,
  shouldSeedInitialData,
} from "./grid-request";
import type { GridCapabilities } from "./types";

const ALL: GridCapabilities = {
  search: true,
  sorting: true,
  pagination: true,
  filtering: true,
  selection: true,
  columnVisibility: true,
};

function build(overrides: Partial<Parameters<typeof buildGridRequest>[0]> = {}) {
  return buildGridRequest({
    pageIndex: 0,
    pageSize: 25,
    search: "",
    sorting: null,
    filters: {},
    capabilities: ALL,
    ...overrides,
  });
}

describe("page index conversion", () => {
  it("sends the API a one-based page for TanStack's zero-based index", () => {
    expect(build({ pageIndex: 0 })).toMatchObject({ page: 1, pageSize: 25 });
    expect(build({ pageIndex: 1 })).toMatchObject({ page: 2 });
    expect(build({ pageIndex: 7 })).toMatchObject({ page: 8 });
  });

  it("never sends a page below one", () => {
    expect(build({ pageIndex: -3 }).page).toBe(1);
  });

  it("carries the requested page size", () => {
    expect(build({ pageSize: 100 }).pageSize).toBe(100);
  });
});

describe("capability flags", () => {
  it("fills unset capabilities from the shared default", () => {
    expect(resolveGridCapabilities()).toMatchObject({
      search: true,
      sorting: true,
      pagination: true,
      filtering: false,
      selection: false,
      columnVisibility: false,
    });
    expect(resolveGridCapabilities({ selection: true }).selection).toBe(true);
  });

  it("omits paging entirely when pagination is off", () => {
    const request = build({
      pageIndex: 3,
      capabilities: { ...ALL, pagination: false },
    });
    expect(request.page).toBeUndefined();
    expect(request.pageSize).toBeUndefined();
  });

  it("omits search when search is off", () => {
    expect(
      build({ search: "fridge", capabilities: { ...ALL, search: false } })
        .search,
    ).toBeUndefined();
  });

  it("omits sorting when sorting is off", () => {
    const request = build({
      sorting: { id: "name", desc: true },
      capabilities: { ...ALL, sorting: false },
    });
    expect(request.sortBy).toBeUndefined();
    expect(request.sortOrder).toBeUndefined();
  });

  it("omits filters when filtering is off", () => {
    expect(
      build({
        filters: { type: ["fridge"] },
        capabilities: { ...ALL, filtering: false },
      }).filters,
    ).toBeUndefined();
  });
});

describe("normalized request", () => {
  it("drops a blank search rather than sending an empty parameter", () => {
    expect(build({ search: "   " }).search).toBeUndefined();
  });

  it("trims the committed search term", () => {
    expect(build({ search: "  freezer " }).search).toBe("freezer");
  });

  it("falls back to the default sort when no column is active", () => {
    expect(
      build({ defaultSort: { sortBy: "name", sortOrder: "asc" } }),
    ).toMatchObject({ sortBy: "name", sortOrder: "asc" });
  });

  it("prefers an active column over the default sort", () => {
    expect(
      build({
        sorting: { id: "type", desc: true },
        defaultSort: { sortBy: "name", sortOrder: "asc" },
      }),
    ).toMatchObject({ sortBy: "type", sortOrder: "desc" });
  });

  it("sends no sort at all when there is neither", () => {
    expect(build().sortBy).toBeUndefined();
  });

  it("produces one identical object for logically identical state", () => {
    const a = build({ filters: { type: ["freezer", "fridge"] } });
    const b = build({ filters: { type: ["fridge", "freezer", "fridge"] } });
    expect(sameGridRequest(a, b)).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("deterministic filter serialization", () => {
  it("sorts keys and values and deduplicates", () => {
    expect(
      normalizeGridFilters({ type: ["freezer", "fridge", "freezer"], role: ["b", "a"] }),
    ).toEqual({ role: ["a", "b"], type: ["freezer", "fridge"] });
  });

  it("omits empty selections", () => {
    expect(normalizeGridFilters({ type: [] })).toBeUndefined();
    expect(normalizeGridFilters({})).toBeUndefined();
    expect(normalizeGridFilters({ type: [], role: ["a"] })).toEqual({
      role: ["a"],
    });
  });

  it("serializes a multi-select as one comma-separated parameter", () => {
    const query = gridRequestToQueryString(
      build({ filters: { type: ["freezer", "fridge"] } }),
    );
    expect(query).toContain("type=freezer%2Cfridge");
  });
});

describe("query string", () => {
  it("writes the whole standard contract", () => {
    const query = gridRequestToQueryString(
      build({
        pageIndex: 1,
        search: "freezer",
        sorting: { id: "name", desc: false },
      }),
    );
    expect(query).toBe("page=2&pageSize=25&search=freezer&sortBy=name&sortOrder=asc");
  });

  it("omits both paging parameters together for an unpaged grid", () => {
    const query = gridRequestToQueryString(
      build({ capabilities: { ...ALL, pagination: false } }),
    );
    expect(query).not.toContain("page");
    expect(query).not.toContain("pageSize");
  });

  it("escapes a search term with reserved characters", () => {
    expect(gridRequestToQueryString(build({ search: "50% off&more" }))).toContain(
      "search=50%25+off%26more",
    );
  });
});

describe("scope comparison", () => {
  const key = ["equipment", "loc-1", "list", { page: 1 }] as const;

  it("accepts a different request within the same scope", () => {
    expect(sameGridScope(["equipment", "loc-1", "list", { page: 2 }], key)).toBe(
      true,
    );
  });

  it("rejects another location", () => {
    expect(sameGridScope(["equipment", "loc-2", "list", { page: 1 }], key)).toBe(
      false,
    );
  });

  it("rejects another resource and a missing previous key", () => {
    expect(
      sameGridScope(["employees", "loc-1", "list", { page: 1 }], key),
    ).toBe(false);
    expect(sameGridScope(undefined, key)).toBe(false);
    expect(sameGridScope(["equipment", "loc-1"], key)).toBe(false);
  });
});

describe("initial data seeding", () => {
  const defaultRequest = build({
    defaultSort: { sortBy: "name", sortOrder: "asc" },
  });

  const base = {
    scopeKey: "loc-1",
    initialScopeKey: "loc-1",
    request: defaultRequest,
    defaultRequest,
    hasInitialPage: true,
  };

  it("seeds when the scope and the request both match", () => {
    expect(shouldSeedInitialData(base)).toBe(true);
  });

  it("refuses another location's server payload", () => {
    expect(
      shouldSeedInitialData({ ...base, initialScopeKey: "loc-2" }),
    ).toBe(false);
  });

  it("refuses a request that is not the server-rendered default", () => {
    expect(
      shouldSeedInitialData({
        ...base,
        request: build({
          pageIndex: 1,
          defaultSort: { sortBy: "name", sortOrder: "asc" },
        }),
      }),
    ).toBe(false);
    expect(
      shouldSeedInitialData({
        ...base,
        request: build({
          search: "fridge",
          defaultSort: { sortBy: "name", sortOrder: "asc" },
        }),
      }),
    ).toBe(false);
  });

  it("does nothing without a server payload", () => {
    expect(shouldSeedInitialData({ ...base, hasInitialPage: false })).toBe(
      false,
    );
  });
});
