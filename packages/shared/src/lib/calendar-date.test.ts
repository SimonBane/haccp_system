import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateRange,
  compareCalendarDates,
  endOfCalendarMonth,
  isCalendarDate,
  startOfCalendarMonth,
} from "./calendar-date.js";

describe("addCalendarDays", () => {
  it("adds days within a month", () => {
    expect(addCalendarDays("2026-08-19", 3)).toBe("2026-08-22");
  });

  it("rolls over a month boundary", () => {
    expect(addCalendarDays("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("rolls over a year boundary", () => {
    expect(addCalendarDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("crosses a leap day correctly", () => {
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("is unaffected by DST transitions, unlike local-time arithmetic", () => {
    // Sofia springs forward on 2026-03-29; a naive local Date(+1 day) can misbehave here.
    expect(addCalendarDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addCalendarDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("throws on a malformed date string", () => {
    expect(() => addCalendarDays("2026-8-19", 1)).toThrow();
    expect(() => addCalendarDays("not-a-date", 1)).toThrow();
  });
});

describe("calendarDateRange", () => {
  it("returns exactly 14 consecutive dates starting at the given date", () => {
    const dates = calendarDateRange("2026-08-19", 14);

    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-08-19");
    expect(dates[13]).toBe("2026-09-01");
  });

  it("has no gaps or duplicates across the range", () => {
    const dates = calendarDateRange("2026-08-19", 14);
    expect(new Set(dates).size).toBe(14);

    for (let i = 1; i < dates.length; i += 1) {
      expect(dates[i]).toBe(addCalendarDays(dates[i - 1]!, 1));
    }
  });

  it("returns an empty array for zero days", () => {
    expect(calendarDateRange("2026-08-19", 0)).toEqual([]);
  });
});

describe("compareCalendarDates", () => {
  it("orders dates chronologically, not lexicographically by accident", () => {
    expect(compareCalendarDates("2026-01-09", "2026-01-10")).toBe(-1);
    expect(compareCalendarDates("2026-02-01", "2026-01-31")).toBe(1);
    expect(compareCalendarDates("2026-08-19", "2026-08-19")).toBe(0);
  });

  it("crosses year boundaries", () => {
    expect(compareCalendarDates("2025-12-31", "2026-01-01")).toBe(-1);
  });

  it("throws on a malformed date string", () => {
    expect(() => compareCalendarDates("2026-8-19", "2026-08-19")).toThrow();
  });
});

describe("isCalendarDate", () => {
  it("accepts a padded ISO calendar date", () => {
    expect(isCalendarDate("2026-08-19")).toBe(true);
  });

  it.each(["2026-8-19", "19-08-2026", "2026-08-19T00:00:00Z", "", "today"])(
    "rejects %o",
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );

  it("does not verify that the day exists", () => {
    expect(isCalendarDate("2026-02-30")).toBe(true);
    expect(addCalendarDays("2026-02-30", 0)).not.toBe("2026-02-30");
  });
});

describe("startOfCalendarMonth / endOfCalendarMonth", () => {
  it("returns the first and last day of the month", () => {
    expect(startOfCalendarMonth("2026-08-19")).toBe("2026-08-01");
    expect(endOfCalendarMonth("2026-08-19")).toBe("2026-08-31");
  });

  it("handles 30-day months", () => {
    expect(endOfCalendarMonth("2026-04-10")).toBe("2026-04-30");
  });

  it("handles February in common and leap years", () => {
    expect(endOfCalendarMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfCalendarMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("handles December", () => {
    expect(startOfCalendarMonth("2026-12-31")).toBe("2026-12-01");
    expect(endOfCalendarMonth("2026-12-01")).toBe("2026-12-31");
  });
});

describe("addCalendarMonths", () => {
  it("shifts forward and backward within a year", () => {
    expect(addCalendarMonths("2026-08-19", 1)).toBe("2026-09-19");
    expect(addCalendarMonths("2026-08-19", -1)).toBe("2026-07-19");
  });

  it("crosses year boundaries", () => {
    expect(addCalendarMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addCalendarMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("clamps to the last valid day of the target month", () => {
    expect(addCalendarMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addCalendarMonths("2028-03-31", -1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});
