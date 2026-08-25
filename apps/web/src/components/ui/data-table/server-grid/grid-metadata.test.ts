import type { GridPage } from "@haccp/shared";
import { describe, expect, expectTypeOf, it } from "vitest";
import { resolveGridTableMode } from "./grid-mode";
import { sameGridScope, shouldSeedInitialData } from "./grid-request";
import type {
  ServerDataGrid,
  ServerGridFetcher,
  UseServerDataGridOptions,
} from "./use-server-data-grid";

type Widget = { id: string; name: string };
type WidgetPage = GridPage<Widget> & { totalInRange: number };

const REQUEST = {
  page: 1,
  pageSize: 25,
  sortBy: "name",
  sortOrder: "asc" as const,
};

describe("response metadata seam", () => {
  it("exposes the whole parsed page, so an extended response keeps its metadata", () => {
    expectTypeOf<ServerDataGrid<Widget, WidgetPage>["page"]>().toEqualTypeOf<
      WidgetPage | undefined
    >();
  });

  it("leaves items and total exactly as before", () => {
    expectTypeOf<ServerDataGrid<Widget, WidgetPage>["items"]>().toEqualTypeOf<
      Widget[]
    >();
    expectTypeOf<
      ServerDataGrid<Widget, WidgetPage>["total"]
    >().toEqualTypeOf<number>();
  });

  it("defaults to the plain GridPage, so a base consumer needs no change", () => {
    expectTypeOf<ServerDataGrid<Widget>["page"]>().toEqualTypeOf<
      GridPage<Widget> | undefined
    >();
    expectTypeOf<
      UseServerDataGridOptions<Widget>["initialPage"]
    >().toEqualTypeOf<GridPage<Widget> | undefined>();
  });

  it("accepts a fetcher that resolves an extended page", () => {
    const fetcher: ServerGridFetcher<WidgetPage> = async () => ({
      items: [],
      total: 0,
      totalInRange: 0,
    });

    expectTypeOf(fetcher).toExtend<ServerGridFetcher<WidgetPage>>();

    // A base fetcher still satisfies the default parameterization.
    const baseFetcher: ServerGridFetcher<GridPage<Widget>> = async () => ({
      items: [],
      total: 0,
    });
    expectTypeOf(baseFetcher).toExtend<ServerGridFetcher<GridPage<Widget>>>();
  });
});

describe("metadata cannot cross a scope or range boundary", () => {
  it("treats two locations as different scopes", () => {
    expect(
      sameGridScope(
        ["records", "location-a", "list", REQUEST],
        ["records", "location-b", "list", REQUEST],
      ),
    ).toBe(false);
  });

  it("treats two date ranges as different scopes", () => {
    expect(
      sameGridScope(
        [
          "records",
          "location-a",
          "range",
          "2026-08-17",
          "2026-08-23",
          "list",
          REQUEST,
        ],
        [
          "records",
          "location-a",
          "range",
          "2026-07-01",
          "2026-07-31",
          "list",
          REQUEST,
        ],
      ),
    ).toBe(false);
  });

  it("keeps one range's pages in the same scope, so placeholders stay valid", () => {
    expect(
      sameGridScope(
        [
          "records",
          "location-a",
          "range",
          "2026-08-17",
          "2026-08-23",
          "list",
          REQUEST,
        ],
        [
          "records",
          "location-a",
          "range",
          "2026-08-17",
          "2026-08-23",
          "list",
          { ...REQUEST, page: 2 },
        ],
      ),
    ).toBe(true);
  });

  it("has no scope in common with an undefined previous key", () => {
    expect(
      sameGridScope(undefined, ["records", "location-a", "list", REQUEST]),
    ).toBe(false);
  });
});

describe("initial-data seeding is unchanged by the seam", () => {
  const defaultRequest = REQUEST;

  it("seeds only the server-rendered scope and default request", () => {
    expect(
      shouldSeedInitialData({
        scopeKey: "location-a",
        initialScopeKey: "location-a",
        request: defaultRequest,
        defaultRequest,
        hasInitialPage: true,
      }),
    ).toBe(true);
  });

  it("refuses another scope or a non-default request", () => {
    expect(
      shouldSeedInitialData({
        scopeKey: "location-b",
        initialScopeKey: "location-a",
        request: defaultRequest,
        defaultRequest,
        hasInitialPage: true,
      }),
    ).toBe(false);

    expect(
      shouldSeedInitialData({
        scopeKey: "location-a",
        initialScopeKey: "location-a",
        request: { ...defaultRequest, page: 2 },
        defaultRequest,
        hasInitialPage: true,
      }),
    ).toBe(false);
  });
});

describe("client mode is untouched", () => {
  it("stays fully client-processed when no server config is passed", () => {
    expect(resolveGridTableMode(undefined)).toEqual({
      mode: "client",
      manualPagination: false,
      manualSorting: false,
      manualFiltering: false,
      rowCount: undefined,
    });
  });

  it("switches every manual flag together in server mode", () => {
    expect(resolveGridTableMode({ rowCount: 27 })).toEqual({
      mode: "server",
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      rowCount: 27,
    });
  });
});
