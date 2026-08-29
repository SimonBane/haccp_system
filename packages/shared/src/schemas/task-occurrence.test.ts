import { describe, expect, it } from "vitest";
import { startOfLocalDay, wallClockToInstant } from "../lib/timezone.js";
import {
  computeAvailableAt,
  computeDueAt,
  deriveOccurrenceState,
  deriveTemperatureResult,
  isActiveRecord,
} from "./task-occurrence.js";

const DUE = new Date("2026-08-19T08:00:00Z");

describe("deriveOccurrenceState", () => {
  it("is pending when there is no record and the deadline has not passed", () => {
    const result = deriveOccurrenceState({
      dueAt: DUE,
      now: new Date("2026-08-19T07:00:00Z"),
      record: null,
    });

    expect(result).toEqual({ status: "pending", timeliness: null });
  });

  it("is missed once the deadline passes with no record", () => {
    const result = deriveOccurrenceState({
      dueAt: DUE,
      now: new Date("2026-08-19T08:00:00Z"),
      record: null,
    });

    expect(result).toEqual({ status: "missed", timeliness: null });
  });

  it("is completed and on time when recorded at or before the deadline", () => {
    const result = deriveOccurrenceState({
      dueAt: DUE,
      now: new Date("2026-08-19T09:00:00Z"),
      record: { recordedAt: DUE, voidedAt: null },
    });

    expect(result).toEqual({ status: "completed", timeliness: "on_time" });
  });

  it("is completed and late when recorded after the deadline", () => {
    const result = deriveOccurrenceState({
      dueAt: DUE,
      now: new Date("2026-08-19T09:00:00Z"),
      record: {
        recordedAt: new Date("2026-08-19T08:00:01Z"),
        voidedAt: null,
      },
    });

    expect(result).toEqual({ status: "completed", timeliness: "late" });
  });

  it("falls back to pending/missed for a voided record, as if none existed", () => {
    const pending = deriveOccurrenceState({
      dueAt: DUE,
      now: new Date("2026-08-19T07:00:00Z"),
      record: { recordedAt: DUE, voidedAt: new Date("2026-08-19T07:30:00Z") },
    });
    expect(pending).toEqual({ status: "pending", timeliness: null });

    const missed = deriveOccurrenceState({
      dueAt: DUE,
      now: new Date("2026-08-19T09:00:00Z"),
      record: { recordedAt: DUE, voidedAt: new Date("2026-08-19T08:30:00Z") },
    });
    expect(missed).toEqual({ status: "missed", timeliness: null });
  });
});

describe("isActiveRecord", () => {
  it("rejects null, undefined and voided records", () => {
    expect(isActiveRecord(null)).toBe(false);
    expect(isActiveRecord(undefined)).toBe(false);
    expect(isActiveRecord({ recordedAt: DUE, voidedAt: DUE })).toBe(false);
  });

  it("accepts a record with no void timestamp", () => {
    expect(isActiveRecord({ recordedAt: DUE, voidedAt: null })).toBe(true);
  });
});

describe("computeAvailableAt", () => {
  const TZ = "Europe/Sofia";

  it("opens completionOpensBeforeMinutes before the scheduled instant when that stays within the local day", () => {
    const scheduledInstant = wallClockToInstant("2026-08-19", "09:00", TZ);
    const startOfDay = startOfLocalDay("2026-08-19", TZ);

    const availableAt = computeAvailableAt({
      scheduledInstant,
      startOfLocalDay: startOfDay,
      completionOpensBeforeMinutes: 30,
    });

    expect(availableAt.toISOString()).toBe(
      new Date(scheduledInstant.getTime() - 30 * 60_000).toISOString(),
    );
  });

  it("clamps to the start of the local day — a task never opens on the previous local date", () => {
    const scheduledInstant = wallClockToInstant("2026-08-19", "01:00", TZ);
    const startOfDay = startOfLocalDay("2026-08-19", TZ);

    const availableAt = computeAvailableAt({
      scheduledInstant,
      startOfLocalDay: startOfDay,
      completionOpensBeforeMinutes: 1440,
    });

    expect(availableAt.getTime()).toBe(startOfDay.getTime());
  });

  it("is available from the start of the local day for the default 1440-minute offset", () => {
    const scheduledInstant = wallClockToInstant("2026-08-19", "08:00", TZ);
    const startOfDay = startOfLocalDay("2026-08-19", TZ);

    const availableAt = computeAvailableAt({
      scheduledInstant,
      startOfLocalDay: startOfDay,
      completionOpensBeforeMinutes: 1440,
    });

    expect(availableAt.getTime()).toBe(startOfDay.getTime());
  });

  it("equals the scheduled instant for a zero-minute offset", () => {
    const scheduledInstant = wallClockToInstant("2026-08-19", "08:00", TZ);
    const startOfDay = startOfLocalDay("2026-08-19", TZ);

    const availableAt = computeAvailableAt({
      scheduledInstant,
      startOfLocalDay: startOfDay,
      completionOpensBeforeMinutes: 0,
    });

    expect(availableAt.getTime()).toBe(scheduledInstant.getTime());
  });

  it("resolves correctly across a Sofia DST spring-forward local day", () => {
    // 2026-03-29: Sofia springs forward at 03:00 -> 04:00 local.
    const scheduledInstant = wallClockToInstant("2026-03-29", "09:00", TZ);
    const startOfDay = startOfLocalDay("2026-03-29", TZ);

    const availableAt = computeAvailableAt({
      scheduledInstant,
      startOfLocalDay: startOfDay,
      completionOpensBeforeMinutes: 60,
    });

    expect(availableAt.toISOString()).toBe(
      new Date(scheduledInstant.getTime() - 60 * 60_000).toISOString(),
    );
    expect(availableAt.getTime()).toBeGreaterThan(startOfDay.getTime());
  });
});

describe("computeDueAt", () => {
  const TZ = "Europe/Sofia";
  const scheduledInstant = wallClockToInstant("2026-08-19", "08:00", TZ);

  it("adds completionDueAfterMinutes to the scheduled instant", () => {
    const dueAt = computeDueAt({
      scheduledInstant,
      completionDueAfterMinutes: 90,
    });

    expect(dueAt?.toISOString()).toBe(
      new Date(scheduledInstant.getTime() + 90 * 60_000).toISOString(),
    );
  });

  it("equals the scheduled instant for a zero-minute deadline", () => {
    const dueAt = computeDueAt({
      scheduledInstant,
      completionDueAfterMinutes: 0,
    });

    expect(dueAt?.getTime()).toBe(scheduledInstant.getTime());
  });

  it("is null — Never overdue — for a null completionDueAfterMinutes", () => {
    expect(
      computeDueAt({ scheduledInstant, completionDueAfterMinutes: null }),
    ).toBeNull();
  });
});

describe("deriveTemperatureResult", () => {
  it("reads the result straight from the stored detail", () => {
    expect(deriveTemperatureResult({ result: "ok" })).toBe("ok");
    expect(deriveTemperatureResult({ result: "out_of_range" })).toBe(
      "out_of_range",
    );
  });

  it("is null when there is no temperature detail", () => {
    expect(deriveTemperatureResult(null)).toBeNull();
    expect(deriveTemperatureResult(undefined)).toBeNull();
  });
});
