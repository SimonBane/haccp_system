import { describe, expect, it } from "vitest";
import {
  hasActiveGridQuery,
  initialServerGridState,
  selectedRowIds,
  serverGridReducer,
  type ServerGridAction,
  type ServerGridState,
} from "./grid-reducer";

const INIT = { scopeKey: "loc-1", pageSize: 25 };

function stateWith(overrides: Partial<ServerGridState> = {}): ServerGridState {
  return { ...initialServerGridState(INIT), ...overrides };
}

const SELECTED = { "row-1": true, "row-2": true };

function apply(state: ServerGridState, action: ServerGridAction) {
  return serverGridReducer(state, action);
}

describe("initial state", () => {
  it("starts on the first page with nothing selected", () => {
    expect(initialServerGridState(INIT)).toEqual({
      scopeKey: "loc-1",
      pageIndex: 0,
      pageSize: 25,
      searchDraft: "",
      search: "",
      sorting: null,
      filters: {},
      rowSelection: {},
    });
  });

  it("adopts the resource's default sort so the header shows it", () => {
    expect(
      initialServerGridState({
        ...INIT,
        defaultSort: { sortBy: "title", sortOrder: "desc" },
      }).sorting,
    ).toEqual({ id: "title", desc: true });
  });
});

describe("page reset rules", () => {
  const onPageThree = stateWith({ pageIndex: 2 });

  it("resets to the first page after a committed search", () => {
    expect(apply(onPageThree, { type: "commitSearch", search: "x" }).pageIndex).toBe(0);
  });

  it("resets to the first page after a sorting change", () => {
    expect(
      apply(onPageThree, { type: "setSorting", sorting: { id: "name", desc: false } })
        .pageIndex,
    ).toBe(0);
  });

  it("resets to the first page after a filter change and after clearing filters", () => {
    const filtered = apply(onPageThree, {
      type: "setFilter",
      key: "type",
      values: ["fridge"],
    });
    expect(filtered.pageIndex).toBe(0);

    const onPageTwoFiltered = { ...filtered, pageIndex: 1 };
    expect(apply(onPageTwoFiltered, { type: "clearFilters" }).pageIndex).toBe(0);
  });

  it("resets to the first page after a page-size change", () => {
    expect(apply(onPageThree, { type: "setPageSize", pageSize: 50 }).pageIndex).toBe(0);
  });

  it("does not reset the page for a draft keystroke", () => {
    expect(
      apply(onPageThree, { type: "setSearchDraft", search: "fri" }).pageIndex,
    ).toBe(2);
  });

  it("keeps a page change on the requested page", () => {
    expect(apply(stateWith(), { type: "setPageIndex", pageIndex: 4 }).pageIndex).toBe(4);
  });

  it("never lands on a negative page", () => {
    expect(apply(onPageThree, { type: "setPageIndex", pageIndex: -2 }).pageIndex).toBe(0);
  });
});

describe("search draft and commit", () => {
  it("keeps the draft out of the request until it is committed", () => {
    const drafted = apply(stateWith(), { type: "setSearchDraft", search: "fri" });
    expect(drafted.searchDraft).toBe("fri");
    expect(drafted.search).toBe("");
  });

  it("clears the draft the moment the input is emptied", () => {
    const drafted = apply(stateWith(), { type: "setSearchDraft", search: "fri" });
    expect(apply(drafted, { type: "setSearchDraft", search: "" }).searchDraft).toBe("");
  });

  it("drops back to the unfiltered list when the committed term is cleared", () => {
    const searched = apply(stateWith({ pageIndex: 2 }), {
      type: "commitSearch",
      search: "fridge",
    });
    const cleared = apply(searched, { type: "commitSearch", search: "" });
    expect(cleared.search).toBe("");
    expect(cleared.pageIndex).toBe(0);
  });

  it("leaves state untouched when the committed term is unchanged", () => {
    const searched = apply(stateWith(), { type: "commitSearch", search: "fridge" });
    expect(apply(searched, { type: "commitSearch", search: "fridge" })).toBe(searched);
  });
});

describe("selection clearing", () => {
  const selected = stateWith({ pageIndex: 1, rowSelection: SELECTED });

  it.each<[string, ServerGridAction]>([
    ["a page change", { type: "setPageIndex", pageIndex: 2 }],
    ["a page-size change", { type: "setPageSize", pageSize: 50 }],
    ["a committed search", { type: "commitSearch", search: "fridge" }],
    ["a sorting change", { type: "setSorting", sorting: { id: "name", desc: true } }],
    ["a filter change", { type: "setFilter", key: "type", values: ["fridge"] }],
    ["clearing filters", { type: "setFilter", key: "type", values: ["fridge"] }],
    ["an explicit clear", { type: "clearSelection" }],
  ])("clears every selected row on %s", (_label, action) => {
    expect(apply(selected, action).rowSelection).toEqual({});
  });

  it("clears selection when the scope changes", () => {
    expect(
      apply(selected, {
        type: "resetScope",
        init: { scopeKey: "loc-2", pageSize: 25 },
      }),
    ).toEqual(initialServerGridState({ scopeKey: "loc-2", pageSize: 25 }));
  });

  it("keeps selection for a draft keystroke, which changes no rows", () => {
    expect(
      apply(selected, { type: "setSearchDraft", search: "fri" }).rowSelection,
    ).toEqual(SELECTED);
  });

  it("accepts a select-all-page update from the table", () => {
    expect(
      apply(stateWith(), { type: "setRowSelection", rowSelection: SELECTED })
        .rowSelection,
    ).toEqual(SELECTED);
  });
});

describe("current-page-only selection", () => {
  it("reports only ids that are on the rendered page", () => {
    expect(selectedRowIds(SELECTED, ["row-2", "row-9"])).toEqual(["row-2"]);
  });

  it("drops an id a refetch removed from the page", () => {
    expect(selectedRowIds(SELECTED, ["row-9"])).toEqual([]);
  });

  it("ignores explicitly deselected rows", () => {
    expect(
      selectedRowIds({ "row-1": true, "row-2": false }, ["row-1", "row-2"]),
    ).toEqual(["row-1"]);
  });
});

describe("last-page clamping", () => {
  it("moves back to the last page that still exists", () => {
    const stranded = stateWith({ pageIndex: 3, rowSelection: SELECTED });
    const clamped = apply(stranded, { type: "clampToLastPage", total: 26 });
    expect(clamped.pageIndex).toBe(1);
    expect(clamped.rowSelection).toEqual({});
  });

  it("falls back to the first page when everything is gone", () => {
    expect(
      apply(stateWith({ pageIndex: 4 }), { type: "clampToLastPage", total: 0 })
        .pageIndex,
    ).toBe(0);
  });

  it("leaves a valid page alone", () => {
    const valid = stateWith({ pageIndex: 1 });
    expect(apply(valid, { type: "clampToLastPage", total: 40 })).toBe(valid);
  });
});

describe("filters", () => {
  it("normalizes values on the way in", () => {
    expect(
      apply(stateWith(), {
        type: "setFilter",
        key: "type",
        values: ["fridge", "freezer", "fridge"],
      }).filters,
    ).toEqual({ type: ["freezer", "fridge"] });
  });

  it("removes a key rather than storing an empty selection", () => {
    const filtered = apply(stateWith(), {
      type: "setFilter",
      key: "type",
      values: ["fridge"],
    });
    expect(
      apply(filtered, { type: "setFilter", key: "type", values: [] }).filters,
    ).toEqual({});
  });

  it("treats an unchanged selection as a no-op", () => {
    const filtered = apply(stateWith(), {
      type: "setFilter",
      key: "type",
      values: ["fridge"],
    });
    expect(
      apply(filtered, { type: "setFilter", key: "type", values: ["fridge"] }),
    ).toBe(filtered);
  });
});

describe("active query", () => {
  it("is inactive with no search and no filters", () => {
    expect(hasActiveGridQuery(stateWith())).toBe(false);
    expect(hasActiveGridQuery(stateWith({ searchDraft: "typing" }))).toBe(false);
  });

  it("is active once a search or a filter is committed", () => {
    expect(hasActiveGridQuery(stateWith({ search: "fridge" }))).toBe(true);
    expect(hasActiveGridQuery(stateWith({ filters: { type: ["fridge"] } }))).toBe(true);
  });
});
