import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatWindowRange,
  hasWindow,
  windowOf,
  type WindowLabels,
} from "./completion-window";

const labels: WindowLabels = {
  duration: {
    minutes: (count) => `${count} min`,
    hours: (count) => `${count} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },
  anyTime: "Any time that day",
  startAtTime: "From the time",
  startAtStartOfDay: "From the start of the day",
  startBefore: (duration) => `From ${duration} before`,
  endAtTime: "the time",
  endAfter: (duration) => `${duration} after`,
  range: (start, end) => `${start} to ${end}`,
  rangeNoDeadline: (start) => `${start}, no deadline`,
};

describe("formatDuration", () => {
  it("uses minutes, whole hours or both", () => {
    expect(formatDuration(30, labels.duration)).toBe("30 min");
    expect(formatDuration(120, labels.duration)).toBe("2 h");
    expect(formatDuration(90, labels.duration)).toBe("1 h 30 min");
  });
});

describe("hasWindow", () => {
  it("treats the start of the day with no deadline as always available", () => {
    expect(hasWindow({ completionOpensBeforeMinutes: 1440, completionDueAfterMinutes: null })).toBe(
      false,
    );
    expect(windowOf({ completionOpensBeforeMinutes: 1440, completionDueAfterMinutes: null })).toBe(
      null,
    );
  });

  it("keeps any deadline or later opening as a window", () => {
    expect(hasWindow({ completionOpensBeforeMinutes: 1440, completionDueAfterMinutes: 0 })).toBe(
      true,
    );
    expect(windowOf({ completionOpensBeforeMinutes: 30, completionDueAfterMinutes: null })).toEqual(
      { opensBefore: 30, dueAfter: null },
    );
  });
});

describe("formatWindowRange", () => {
  it("describes no window as any time that day", () => {
    expect(formatWindowRange(null, labels)).toBe("Any time that day");
  });

  it("reads as a range from the opening to the deadline", () => {
    expect(formatWindowRange({ opensBefore: 30, dueAfter: 60 }, labels)).toBe(
      "From 30 min before to 1 h after",
    );
    expect(formatWindowRange({ opensBefore: 0, dueAfter: 0 }, labels)).toBe(
      "From the time to the time",
    );
    expect(formatWindowRange({ opensBefore: 1440, dueAfter: 0 }, labels)).toBe(
      "From the start of the day to the time",
    );
  });

  it("says there is no deadline when the check is never overdue", () => {
    expect(formatWindowRange({ opensBefore: 15, dueAfter: null }, labels)).toBe(
      "From 15 min before, no deadline",
    );
  });
});
