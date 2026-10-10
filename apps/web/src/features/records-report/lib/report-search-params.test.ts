import { describe, expect, it } from "vitest";
import {
  parseReportSearchParams,
  reportApiQuery,
} from "./report-search-params";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_LOCATION_ID = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-08-23";

function parse(searchParams: Record<string, string | string[] | undefined>) {
  return parseReportSearchParams({
    searchParams,
    locationIds: [LOCATION_ID],
    today: TODAY,
  });
}

function valid(overrides: Record<string, string | string[]> = {}) {
  return {
    locationId: LOCATION_ID,
    dateFrom: "2026-08-17",
    dateTo: TODAY,
    ...overrides,
  };
}

describe("parseReportSearchParams", () => {
  it("accepts a valid link and keeps the canonical filter values", () => {
    const result = parse(valid({ state: "open,missed" }));

    expect(result).toMatchObject({
      ok: true,
      params: {
        locationId: LOCATION_ID,
        dateFrom: "2026-08-17",
        dateTo: TODAY,
        state: ["missed", "open"],
      },
    });
  });

  it.each([
    ["a missing locationId", { dateFrom: "2026-08-17", dateTo: TODAY }],
    ["a missing date", { locationId: LOCATION_ID, dateFrom: "2026-08-17" }],
    ["a grid page", valid({ page: "2" })],
    ["a grid sort", valid({ sortBy: "title" })],
    ["a pending status", valid({ state: "pending" })],
    ["a repeated parameter", valid({ state: ["open", "missed"] })],
  ])("rejects %s as malformed", (_label, searchParams) => {
    expect(parse(searchParams)).toEqual({ ok: false, error: "malformed" });
  });

  it("rejects a location the tenant does not own", () => {
    expect(parse(valid({ locationId: OTHER_LOCATION_ID }))).toEqual({
      ok: false,
      error: "unknownLocation",
    });
  });

  it("rejects a crafted future range without throwing", () => {
    expect(parse(valid({ dateTo: "2026-08-24" }))).toEqual({
      ok: false,
      error: "futureRange",
    });
  });

  it("accepts a range ending exactly on the organization's today", () => {
    expect(parse(valid({ dateFrom: TODAY })).ok).toBe(true);
  });

  it.each([
    ["60-day", "2026-06-25"],
    ["90-day", "2026-05-26"],
    ["one-year", "2025-08-23"],
  ])("imposes no span cap on a %s range", (_label, dateFrom) => {
    expect(parse(valid({ dateFrom })).ok).toBe(true);
  });
});

describe("reportApiQuery", () => {
  it("sends the range alone when nothing is filtered", () => {
    const result = parse(valid());
    expect(result.ok).toBe(true);

    expect(reportApiQuery(result.ok ? result.params : never())).toBe(
      "dateFrom=2026-08-17&dateTo=2026-08-23",
    );
  });

  it("serializes multi-select filters the same way the grid does", () => {
    const result = parse(
      valid({ state: "open,missed", category: "temperature", result: "fail" }),
    );
    expect(result.ok).toBe(true);

    const query = reportApiQuery(result.ok ? result.params : never());

    expect(query).toContain("category=temperature");
    expect(query).toContain("state=missed%2Copen");
    expect(query).toContain("result=fail");
  });

  it("never sends paging or sorting", () => {
    const result = parse(valid({ state: "open" }));
    const query = reportApiQuery(result.ok ? result.params : never());

    expect(query).not.toMatch(/page|pageSize|sortBy|sortOrder/);
  });
});

function never(): never {
  throw new Error("expected the search params to parse");
}
