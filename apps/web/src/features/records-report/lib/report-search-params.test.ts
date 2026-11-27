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
  it("forwards the late filter and items left out of a journal", () => {
    const form = "33333333-3333-4333-8333-333333333333";
    const target = "44444444-4444-4444-8444-444444444444";
    const result = parse(valid({ timing: "late", exclude: `${form}:${target}` }));
    expect(result.ok).toBe(true);

    const query = new URLSearchParams(
      reportApiQuery(result.ok ? result.params : never()),
    );
    expect(query.get("timing")).toBe("late");
    expect(query.get("exclude")).toBe(`${form}:${target}`);
  });

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

  it("forwards the check, item and person filters, and not the layout", () => {
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const result = parse(
      valid({
        form: `${B},${A}`,
        target: A,
        recordedBy: B,
        layout: "journals",
      }),
    );
    expect(result.ok).toBe(true);

    const query = reportApiQuery(result.ok ? result.params : never());

    expect(query).toContain(`form=${A}%2C${B}`);
    expect(query).toContain(`target=${A}`);
    expect(query).toContain(`recordedBy=${B}`);
    expect(query).not.toContain("layout");
  });

  it("asks for every failed, non-voided record for the deviations layout", () => {
    const result = parse(
      valid({ layout: "deviations", state: "missed", result: "pass" }),
    );
    expect(result.ok).toBe(true);

    const query = new URLSearchParams(
      reportApiQuery(result.ok ? result.params : never()),
    );

    expect(query.get("state")).toBe("submitted");
    expect(query.get("result")).toBe("fail");
  });

  it("keeps the check, item and person filters for the deviations layout", () => {
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const result = parse(valid({ layout: "deviations", target: A }));

    const query = new URLSearchParams(
      reportApiQuery(result.ok ? result.params : never()),
    );

    expect(query.get("target")).toBe(A);
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
