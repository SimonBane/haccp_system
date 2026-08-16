import { describe, expect, it } from "vitest";
import {
  wallClockToInstant,
  zonedDateString,
  zonedMinutesOfDay,
  zoneOffsetMinutes,
} from "./timezone.js";

/** Europe/Sofia: EET UTC+2 / EEST UTC+3; probes the date boundary and DST transitions. */
const SOFIA = "Europe/Sofia";

describe("zonedDateString", () => {
  it("reads the local calendar date, not the UTC one", () => {
    // 2026-03-10T22:30:00Z is 00:30 on the 11th in Sofia (UTC+2).
    expect(zonedDateString(new Date("2026-03-10T22:30:00Z"), SOFIA)).toBe(
      "2026-03-11",
    );
    expect(zonedDateString(new Date("2026-03-10T22:30:00Z"), "UTC")).toBe(
      "2026-03-10",
    );
  });

  it("holds the date steady on either side of local midnight", () => {
    expect(zonedDateString(new Date("2026-03-10T21:59:59Z"), SOFIA)).toBe(
      "2026-03-10",
    );
    expect(zonedDateString(new Date("2026-03-10T22:00:00Z"), SOFIA)).toBe(
      "2026-03-11",
    );
  });

  it("zero-pads single-digit months and days", () => {
    expect(zonedDateString(new Date("2026-01-05T12:00:00Z"), SOFIA)).toBe(
      "2026-01-05",
    );
  });

  it("falls back to the runtime zone rather than throwing on a corrupt value", () => {
    // Corrupt IANA id must not take the page down.
    expect(zonedDateString(new Date("2026-06-15T12:00:00Z"), "Not/AZone")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("zonedMinutesOfDay", () => {
  it("converts to minutes since local midnight", () => {
    expect(zonedMinutesOfDay(new Date("2026-01-15T05:00:00Z"), SOFIA)).toBe(
      7 * 60,
    );
    expect(zonedMinutesOfDay(new Date("2026-01-15T22:00:00Z"), SOFIA)).toBe(0);
  });

  it("stays inside 0-1439 across the day boundary", () => {
    expect(zonedMinutesOfDay(new Date("2026-01-15T21:59:00Z"), SOFIA)).toBe(
      23 * 60 + 59,
    );
  });
});

describe("zoneOffsetMinutes", () => {
  it("reports +120 in winter and +180 in summer for Sofia", () => {
    expect(zoneOffsetMinutes(SOFIA, new Date("2026-01-15T12:00:00Z"))).toBe(120);
    expect(zoneOffsetMinutes(SOFIA, new Date("2026-07-15T12:00:00Z"))).toBe(180);
  });

  it("flips exactly at the spring-forward instant", () => {
    // Sofia springs forward at 01:00 UTC on 2026-03-29.
    expect(zoneOffsetMinutes(SOFIA, new Date("2026-03-29T00:59:00Z"))).toBe(120);
    expect(zoneOffsetMinutes(SOFIA, new Date("2026-03-29T01:00:00Z"))).toBe(180);
  });

  it("flips exactly at the autumn fall-back instant", () => {
    // Sofia falls back at 01:00 UTC on 2026-10-25.
    expect(zoneOffsetMinutes(SOFIA, new Date("2026-10-25T00:59:00Z"))).toBe(180);
    expect(zoneOffsetMinutes(SOFIA, new Date("2026-10-25T01:00:00Z"))).toBe(120);
  });

  it("handles a three-quarter-hour zone", () => {
    expect(
      zoneOffsetMinutes("Asia/Kathmandu", new Date("2026-01-15T12:00:00Z")),
    ).toBe(345);
  });
});

describe("wallClockToInstant", () => {
  it("resolves a winter wall clock at UTC+2", () => {
    expect(
      wallClockToInstant("2026-01-15", "07:00", SOFIA).toISOString(),
    ).toBe("2026-01-15T05:00:00.000Z");
  });

  it("resolves a summer wall clock at UTC+3", () => {
    expect(
      wallClockToInstant("2026-07-15", "07:00", SOFIA).toISOString(),
    ).toBe("2026-07-15T04:00:00.000Z");
  });

  it("round-trips with zonedDateString and zonedMinutesOfDay", () => {
    for (const [date, time] of [
      ["2026-01-15", "07:00"],
      ["2026-07-15", "23:30"],
      ["2026-03-29", "12:00"],
      ["2026-10-25", "12:00"],
    ] as const) {
      const instant = wallClockToInstant(date, time, SOFIA);
      expect(zonedDateString(instant, SOFIA)).toBe(date);
      expect(zonedMinutesOfDay(instant, SOFIA)).toBe(
        Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
      );
    }
  });

  it("resolves the day before a spring-forward without drifting", () => {
    expect(
      wallClockToInstant("2026-03-28", "07:00", SOFIA).toISOString(),
    ).toBe("2026-03-28T05:00:00.000Z");
  });

  it("resolves the day after a spring-forward at the new offset", () => {
    expect(
      wallClockToInstant("2026-03-30", "07:00", SOFIA).toISOString(),
    ).toBe("2026-03-30T04:00:00.000Z");
  });

  it("resolves a time inside the spring-forward gap to just after the jump", () => {
    // DST spring-forward hole: 03:00–03:59 does not exist; must not throw or drift a day.
    const instant = wallClockToInstant("2026-03-29", "03:30", SOFIA);
    expect(Number.isNaN(instant.getTime())).toBe(false);
    expect(zonedDateString(instant, SOFIA)).toBe("2026-03-29");
  });

  it("resolves a repeated autumn wall clock to a real instant on the same day", () => {
    // 03:00-03:59 local happens twice on 2026-10-25 in Sofia.
    const instant = wallClockToInstant("2026-10-25", "03:30", SOFIA);
    expect(Number.isNaN(instant.getTime())).toBe(false);
    expect(zonedDateString(instant, SOFIA)).toBe("2026-10-25");
  });

  it("is monotonic across a day of scheduled times", () => {
    const times = ["00:00", "06:00", "12:00", "18:00", "23:59"];
    const instants = times.map((t) =>
      wallClockToInstant("2026-03-29", t, SOFIA).getTime(),
    );
    for (let i = 1; i < instants.length; i += 1) {
      expect(instants[i]).toBeGreaterThan(instants[i - 1]);
    }
  });
});
