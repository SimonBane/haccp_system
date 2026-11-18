import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  daysForPreset,
  detectRepeatInterval,
  generateRepeatTimes,
  matchDayPreset,
  minutesToTime,
  opensAt,
  overdueAt,
  smallestGap,
  windowsOverlap,
} from "./schedule";

describe("generateRepeatTimes", () => {
  it("includes both ends when they line up with the interval", () => {
    expect(generateRepeatTimes(120, "08:00", "22:00")).toEqual([
      "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00",
    ]);
  });

  it("stops before the end when the interval overshoots it", () => {
    expect(generateRepeatTimes(180, "08:00", "16:00")).toEqual(["08:00", "11:00", "14:00"]);
  });

  it("is empty when the range runs backwards or a bound is missing", () => {
    expect(generateRepeatTimes(60, "22:00", "08:00")).toEqual([]);
    expect(generateRepeatTimes(60, "", "08:00")).toEqual([]);
  });

  it("caps at the 48 times a task may hold", () => {
    expect(generateRepeatTimes(30, "00:00", "23:59")).toHaveLength(48);
  });
});

describe("detectRepeatInterval", () => {
  it("finds an offered interval in evenly spaced times, in any order", () => {
    expect(detectRepeatInterval(["13:00", "11:00", "15:00"])).toBe(120);
  });

  it("needs three times and an even, offered gap", () => {
    expect(detectRepeatInterval(["08:00", "10:00"])).toBeNull();
    expect(detectRepeatInterval(["08:00", "10:00", "13:00"])).toBeNull();
    expect(detectRepeatInterval(["08:00", "08:45", "09:30"])).toBeNull();
  });
});

describe("day presets", () => {
  it("matches the presets regardless of order", () => {
    expect(matchDayPreset(daysForPreset("every"))).toBe("every");
    expect(matchDayPreset(["friday", "monday", "tuesday", "wednesday", "thursday"])).toBe(
      "weekdays",
    );
    expect(matchDayPreset(["sunday", "saturday"])).toBe("weekends");
    expect(matchDayPreset(["monday"])).toBeNull();
  });
});

describe("windows", () => {
  it("measures the smallest gap between checks", () => {
    expect(smallestGap(["08:00", "14:00", "10:00"])).toBe(120);
    expect(smallestGap(["08:00"])).toBeNull();
  });

  it("overlaps when a window is longer than the gap, but never with no deadline", () => {
    expect(windowsOverlap(["08:00", "10:00"], 30, 60)).toBe(false);
    expect(windowsOverlap(["08:00", "10:00"], 60, 120)).toBe(true);
    expect(windowsOverlap(["08:00", "10:00"], 60, null)).toBe(false);
  });

  it("clamps opening and overdue times to the same day", () => {
    expect(opensAt("00:15", 30)).toBe("00:00");
    expect(opensAt("08:00", 30)).toBe("07:30");
    expect(overdueAt("23:30", 60)).toBe("23:59");
    expect(minutesToTime(-30)).toBe("23:30");
  });
});

describe("buildTimeline", () => {
  it("places marks and window bars as percentages of the day", () => {
    const { marks, bars } = buildTimeline(["12:00"], { opensBefore: 60, dueAfter: 60 });
    expect(marks).toEqual([{ time: "12:00", left: 50 }]);
    expect(bars[0]?.left).toBeCloseTo((11 / 24) * 100);
    expect(bars[0]?.width).toBeCloseTo((2 / 24) * 100);
  });

  it("draws no bars without a window and runs to midnight with no deadline", () => {
    expect(buildTimeline(["12:00"], null).bars).toEqual([]);
    const { bars } = buildTimeline(["12:00"], { opensBefore: 0, dueAfter: null });
    expect(bars[0]?.left + bars[0]!.width).toBeCloseTo(100);
  });
});
