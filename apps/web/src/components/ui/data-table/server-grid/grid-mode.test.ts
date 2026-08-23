import { describe, expect, it } from "vitest";
import { resolveGridTableMode } from "./grid-mode";

describe("resolveGridTableMode", () => {
  it("leaves TanStack in charge when there is no server config", () => {
    expect(resolveGridTableMode(undefined)).toEqual({
      mode: "client",
      manualPagination: false,
      manualSorting: false,
      manualFiltering: false,
      rowCount: undefined,
    });
  });

  it("hands filtering, sorting and paging to the server when there is one", () => {
    expect(resolveGridTableMode({ rowCount: 42 })).toEqual({
      mode: "server",
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      rowCount: 42,
    });
  });

  it("passes a zero row count through rather than falling back to the row model", () => {
    expect(resolveGridTableMode({ rowCount: 0 })).toMatchObject({
      mode: "server",
      rowCount: 0,
    });
  });
});
