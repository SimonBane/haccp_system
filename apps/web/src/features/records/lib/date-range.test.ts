import { describe, expect, it } from "vitest";
import {
  detectRecordsRangePreset,
  isFutureCalendarDate,
  isSameRecordsRange,
  RECORDS_RANGE_PRESETS,
  recordsRangeError,
  resolveRecordsPreset,
} from "./date-range";

const TODAY = "2026-08-23";

describe("default range", () => {
  it("opens on the last seven inclusive organization-local dates", () => {
    expect(resolveRecordsPreset("last7", TODAY)).toEqual({
      dateFrom: "2026-08-17",
      dateTo: "2026-08-23",
    });
  });
});

describe("rolling-day presets", () => {
  it.each([
    ["last30", "2026-07-25"],
    ["last60", "2026-06-25"],
    ["last90", "2026-05-26"],
  ] as const)("%s ends today and spans the full window", (preset, dateFrom) => {
    expect(resolveRecordsPreset(preset, TODAY)).toEqual({
      dateFrom,
      dateTo: TODAY,
    });
  });

  it("never reaches past today", () => {
    for (const preset of RECORDS_RANGE_PRESETS) {
      const range = resolveRecordsPreset(preset, TODAY);
      expect(isFutureCalendarDate(range.dateTo, TODAY)).toBe(false);
    }
  });
});

describe("calendar-month presets", () => {
  it("clamps this month to today rather than to the month end", () => {
    expect(resolveRecordsPreset("thisMonth", TODAY)).toEqual({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-23",
    });
  });

  it("covers the whole previous month", () => {
    expect(resolveRecordsPreset("previousMonth", TODAY)).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });
  });

  it("crosses a year boundary", () => {
    expect(resolveRecordsPreset("previousMonth", "2026-01-15")).toEqual({
      dateFrom: "2025-12-01",
      dateTo: "2025-12-31",
    });
    expect(resolveRecordsPreset("thisMonth", "2026-01-01")).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-01",
    });
  });

  it("ends February on the 28th or 29th as the year requires", () => {
    expect(resolveRecordsPreset("previousMonth", "2026-03-15").dateTo).toBe(
      "2026-02-28",
    );
    expect(resolveRecordsPreset("previousMonth", "2028-03-15").dateTo).toBe(
      "2028-02-29",
    );
  });

  it("handles the 31st, where naive month arithmetic overflows", () => {
    expect(resolveRecordsPreset("previousMonth", "2026-03-31")).toEqual({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });
    expect(resolveRecordsPreset("previousMonth", "2026-05-31")).toEqual({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });
  });

  it("is unaffected by a DST transition inside the month", () => {
    // Sofia springs forward on 2026-03-29 and falls back on 2026-10-25.
    expect(resolveRecordsPreset("thisMonth", "2026-03-30").dateFrom).toBe(
      "2026-03-01",
    );
    expect(resolveRecordsPreset("previousMonth", "2026-11-02")).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    });
  });
});

describe("detectRecordsRangePreset", () => {
  it("recognises each preset it produced", () => {
    for (const preset of RECORDS_RANGE_PRESETS) {
      expect(
        detectRecordsRangePreset(resolveRecordsPreset(preset, TODAY), TODAY),
      ).toBe(preset);
    }
  });

  it("falls back to custom for a hand-picked range", () => {
    expect(
      detectRecordsRangePreset(
        { dateFrom: "2026-06-11", dateTo: "2026-08-14" },
        TODAY,
      ),
    ).toBe("custom");
  });
});

describe("recordsRangeError", () => {
  it("accepts any valid historical span, including multi-month", () => {
    expect(
      recordsRangeError({ dateFrom: "2026-06-01", dateTo: TODAY }, TODAY),
    ).toBeNull();
    expect(
      recordsRangeError({ dateFrom: "2025-08-23", dateTo: TODAY }, TODAY),
    ).toBeNull();
  });

  it("accepts an empty historical range with no data", () => {
    expect(
      recordsRangeError(
        { dateFrom: "2019-01-01", dateTo: "2019-01-05" },
        TODAY,
      ),
    ).toBeNull();
  });

  it("rejects a future dateTo against organization-local today", () => {
    expect(
      recordsRangeError({ dateFrom: TODAY, dateTo: "2026-08-24" }, TODAY),
    ).toBe("future");
  });

  it("rejects a reversed range", () => {
    expect(
      recordsRangeError({ dateFrom: TODAY, dateTo: "2026-08-17" }, TODAY),
    ).toBe("order");
  });

  it("rejects a malformed date", () => {
    expect(
      recordsRangeError({ dateFrom: "2026-8-1", dateTo: TODAY }, TODAY),
    ).toBe("invalid");
  });
});

describe("isSameRecordsRange", () => {
  it("compares both ends", () => {
    expect(
      isSameRecordsRange(
        { dateFrom: "2026-08-17", dateTo: TODAY },
        { dateFrom: "2026-08-17", dateTo: TODAY },
      ),
    ).toBe(true);
    expect(
      isSameRecordsRange(
        { dateFrom: "2026-08-17", dateTo: TODAY },
        { dateFrom: "2026-08-16", dateTo: TODAY },
      ),
    ).toBe(false);
  });
});
