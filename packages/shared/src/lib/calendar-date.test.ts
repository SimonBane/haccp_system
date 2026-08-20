import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDateRange } from "./calendar-date.js";

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
