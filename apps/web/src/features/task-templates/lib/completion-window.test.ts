import { describe, expect, it } from "vitest";
import {
  formatCompactWindowSummary,
  getDuePreset,
  getOpensPreset,
  isAllowedMinutesInput,
  isFromStartOfDay,
  parseMinutesValue,
} from "./completion-window";

describe("isAllowedMinutesInput", () => {
  it("accepts the empty string and up to 4 digits", () => {
    expect(isAllowedMinutesInput("")).toBe(true);
    expect(isAllowedMinutesInput("0")).toBe(true);
    expect(isAllowedMinutesInput("1440")).toBe(true);
  });

  it("rejects non-digit characters and more than 4 digits", () => {
    expect(isAllowedMinutesInput("-1")).toBe(false);
    expect(isAllowedMinutesInput("1.5")).toBe(false);
    expect(isAllowedMinutesInput("12345")).toBe(false);
  });
});

describe("parseMinutesValue", () => {
  it("parses a digit string to a number", () => {
    expect(parseMinutesValue("90")).toBe(90);
    expect(parseMinutesValue("0")).toBe(0);
  });

  it("is null for an empty string", () => {
    expect(parseMinutesValue("")).toBeNull();
  });
});

describe("isFromStartOfDay", () => {
  it("is true at and above the 1440-minute default", () => {
    expect(isFromStartOfDay(1440)).toBe(true);
  });

  it("is false below the default", () => {
    expect(isFromStartOfDay(1439)).toBe(false);
    expect(isFromStartOfDay(0)).toBe(false);
  });
});

describe("getOpensPreset", () => {
  it("matches each preset rung exactly", () => {
    expect(getOpensPreset(1440)).toBe("startOfDay");
    expect(getOpensPreset(120)).toBe("min120");
    expect(getOpensPreset(60)).toBe("min60");
    expect(getOpensPreset(30)).toBe("min30");
    expect(getOpensPreset(0)).toBe("atScheduledTime");
  });

  it("falls back to custom for a value off the ladder, including retired rungs", () => {
    expect(getOpensPreset(47)).toBe("custom");
    expect(getOpensPreset(240)).toBe("custom");
    expect(getOpensPreset(15)).toBe("custom");
  });

  it("falls back to custom for an unparsed (null) value", () => {
    expect(getOpensPreset(null)).toBe("custom");
  });
});

describe("getDuePreset", () => {
  it("matches each preset rung exactly", () => {
    expect(getDuePreset(30, false)).toBe("min30");
    expect(getDuePreset(60, false)).toBe("min60");
    expect(getDuePreset(120, false)).toBe("min120");
    expect(getDuePreset(0, false)).toBe("atScheduledTime");
  });

  it("is never when Never overdue is set, regardless of the stored minutes", () => {
    expect(getDuePreset(60, true)).toBe("never");
    expect(getDuePreset(null, true)).toBe("never");
  });

  it("falls back to custom for a value off the ladder, including retired rungs", () => {
    expect(getDuePreset(47, false)).toBe("custom");
    expect(getDuePreset(15, false)).toBe("custom");
    expect(getDuePreset(240, false)).toBe("custom");
  });

  it("falls back to custom for an unparsed (null) value when not Never overdue", () => {
    expect(getDuePreset(null, false)).toBe("custom");
  });
});

describe("formatCompactWindowSummary", () => {
  const labels = {
    fromStartOfDay: "All day",
    opensBefore: (minutes: number) => `${minutes} min before`,
    neverOverdue: "No deadline",
    overdueAfter: (minutes: number) => `${minutes} min after`,
  };

  it("summarizes the default window as All day / No deadline shape", () => {
    expect(
      formatCompactWindowSummary({
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
        labels,
      }),
    ).toBe("All day · 0 min after");
  });

  it("summarizes a narrow window with a finite deadline", () => {
    expect(
      formatCompactWindowSummary({
        completionOpensBeforeMinutes: 30,
        completionDueAfterMinutes: 60,
        labels,
      }),
    ).toBe("30 min before · 60 min after");
  });

  it("summarizes Never overdue", () => {
    expect(
      formatCompactWindowSummary({
        completionOpensBeforeMinutes: 30,
        completionDueAfterMinutes: null,
        labels,
      }),
    ).toBe("30 min before · No deadline");
  });
});
