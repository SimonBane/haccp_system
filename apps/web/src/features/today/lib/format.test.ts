import { describe, expect, it } from "vitest";
import { formatDayMonth, formatWeekdayDayMonth, relativeDay } from "./format";

describe("relativeDay", () => {
  const today = "2026-11-23";

  it("names the days either side of today", () => {
    expect(relativeDay("2026-11-23", today)).toBe("today");
    expect(relativeDay("2026-11-22", today)).toBe("yesterday");
    expect(relativeDay("2026-11-24", today)).toBe("tomorrow");
  });

  it("leaves every other day unnamed", () => {
    expect(relativeDay("2026-11-21", today)).toBeNull();
    expect(relativeDay("2026-11-25", today)).toBeNull();
  });

  it("crosses month and year boundaries", () => {
    expect(relativeDay("2026-12-31", "2027-01-01")).toBe("yesterday");
    expect(relativeDay("2027-03-01", "2027-02-28")).toBe("tomorrow");
  });
});

describe("formatDayMonth", () => {
  it("spells the month out in Bulgarian, where a short month prints as digits", () => {
    expect(formatDayMonth("2026-11-23", "bg")).toBe("23 ноември");
  });

  it("abbreviates the month in English", () => {
    expect(formatDayMonth("2026-11-23", "en")).toBe("Nov 23");
  });
});

describe("formatWeekdayDayMonth", () => {
  it("leads with the short weekday", () => {
    expect(formatWeekdayDayMonth("2026-11-20", "bg")).toBe("пт, 20 ноември");
    expect(formatWeekdayDayMonth("2026-11-20", "en")).toBe("Fri, Nov 20");
  });
});
