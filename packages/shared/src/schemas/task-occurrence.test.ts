import { describe, expect, it } from "vitest";
import {
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
