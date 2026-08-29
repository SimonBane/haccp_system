import { describe, expect, it } from "vitest";
import {
  buildTodayTaskItemFromOccurrence,
  deriveRecordState,
  deriveTodayTaskStatusFromOccurrence,
  RECORD_STATE,
  todayTaskItemSchema,
} from "./today.js";

const AVAILABLE_AT = new Date("2026-01-15T00:00:00Z");
const DUE_AT = new Date("2026-01-15T07:00:00Z");

describe("deriveRecordState", () => {
  it("is none when there is no record", () => {
    expect(deriveRecordState(null)).toBe(RECORD_STATE.NONE);
  });

  it("is active when the record is not voided", () => {
    expect(
      deriveRecordState({ recordedAt: DUE_AT, voidedAt: null }),
    ).toBe(RECORD_STATE.ACTIVE);
  });

  it("is voided when the record has a voidedAt", () => {
    expect(
      deriveRecordState({ recordedAt: DUE_AT, voidedAt: new Date() }),
    ).toBe(RECORD_STATE.VOIDED);
  });
});

describe("deriveTodayTaskStatusFromOccurrence", () => {
  it("is upcoming before availableAt with no active record", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.NONE,
        availableAt: AVAILABLE_AT,
        dueAt: DUE_AT,
        now: new Date("2026-01-14T23:00:00Z"),
      }),
    ).toBe("upcoming");
  });

  it("is pending at exactly availableAt with no active record", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.NONE,
        availableAt: AVAILABLE_AT,
        dueAt: DUE_AT,
        now: AVAILABLE_AT,
      }),
    ).toBe("pending");
  });

  it("is pending between availableAt and a finite deadline with no active record", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.NONE,
        availableAt: AVAILABLE_AT,
        dueAt: DUE_AT,
        now: new Date("2026-01-15T06:00:00Z"),
      }),
    ).toBe("pending");
  });

  it("is overdue once a finite deadline passes with no active record", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.NONE,
        availableAt: AVAILABLE_AT,
        dueAt: DUE_AT,
        now: DUE_AT,
      }),
    ).toBe("overdue");
  });

  it("is overdue for a voided record past the deadline, same as none", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.VOIDED,
        availableAt: AVAILABLE_AT,
        dueAt: DUE_AT,
        now: new Date("2026-01-15T08:00:00Z"),
      }),
    ).toBe("overdue");
  });

  it("is completed for an active record regardless of the deadline", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.ACTIVE,
        availableAt: AVAILABLE_AT,
        dueAt: DUE_AT,
        now: new Date("2026-01-15T09:00:00Z"),
      }),
    ).toBe("completed");
  });

  it("never becomes overdue for a no-deadline occurrence, however late", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.NONE,
        availableAt: AVAILABLE_AT,
        dueAt: null,
        now: new Date("2026-02-15T09:00:00Z"),
      }),
    ).toBe("pending");
  });

  it("is upcoming for a no-deadline occurrence before it opens", () => {
    expect(
      deriveTodayTaskStatusFromOccurrence({
        recordState: RECORD_STATE.NONE,
        availableAt: AVAILABLE_AT,
        dueAt: null,
        now: new Date("2026-01-14T23:00:00Z"),
      }),
    ).toBe("upcoming");
  });
});

describe("buildTodayTaskItemFromOccurrence", () => {
  const BASE = {
    occurrenceId: "00000000-0000-4000-8000-00000000000a",
    templateId: "00000000-0000-4000-8000-00000000000t",
    title: "Check walk-in fridge",
    type: "temperature" as const,
    equipmentId: "00000000-0000-4000-8000-00000000000e",
    equipmentName: "Walk-in fridge",
    minTempC: 0,
    maxTempC: 5,
    scheduledTime: "07:00",
    date: "2026-01-15",
    availableAt: AVAILABLE_AT,
    dueAt: DUE_AT,
  };

  it("reports a voided record as uncompleted with recordState voided", () => {
    const item = buildTodayTaskItemFromOccurrence({
      ...BASE,
      now: new Date("2026-01-15T08:00:00Z"),
      record: { recordedAt: DUE_AT, voidedAt: new Date("2026-01-15T07:30:00Z") },
      recordedBy: { id: "u1", firstName: "Ann", lastName: "Lee" },
      temperatureReading: {
        recordedC: 3.1,
        minTempC: 0,
        maxTempC: 5,
        result: "ok",
        correctiveAction: null,
      },
    });

    expect(item.recordState).toBe("voided");
    expect(item.status).toBe("overdue");
    expect(item.completedAt).toBeNull();
    expect(item.completedBy).toBeNull();
    expect(item.temperatureReading).toBeNull();
  });

  it("carries the reading for an active record", () => {
    const recordedAt = new Date("2026-01-15T06:55:00Z");
    const item = buildTodayTaskItemFromOccurrence({
      ...BASE,
      now: new Date("2026-01-15T08:00:00Z"),
      record: { recordedAt, voidedAt: null },
      recordedBy: { id: "u1", firstName: "Ann", lastName: "Lee" },
      temperatureReading: {
        recordedC: 3.1,
        minTempC: 0,
        maxTempC: 5,
        result: "ok",
        correctiveAction: null,
      },
    });

    expect(item.recordState).toBe("active");
    expect(item.status).toBe("completed");
    expect(item.completedAt).toBe(recordedAt.toISOString());
    expect(item.completedBy).toEqual({ id: "u1", firstName: "Ann", lastName: "Lee" });
    expect(item.temperatureReading?.recordedC).toBe(3.1);
  });

  it("derives upcoming/pending/overdue by availableAt and dueAt when there is no record", () => {
    const upcoming = buildTodayTaskItemFromOccurrence({
      ...BASE,
      now: new Date("2026-01-14T23:00:00Z"),
      record: null,
      recordedBy: null,
    });
    const pending = buildTodayTaskItemFromOccurrence({
      ...BASE,
      now: new Date("2026-01-15T06:00:00Z"),
      record: null,
      recordedBy: null,
    });
    const overdue = buildTodayTaskItemFromOccurrence({
      ...BASE,
      now: new Date("2026-01-15T07:30:00Z"),
      record: null,
      recordedBy: null,
    });

    expect(upcoming.status).toBe("upcoming");
    expect(pending.status).toBe("pending");
    expect(overdue.status).toBe("overdue");
    expect(pending.recordState).toBe("none");
  });

  it("serializes availableAt and a null dueAt for a Never overdue occurrence", () => {
    const item = buildTodayTaskItemFromOccurrence({
      ...BASE,
      dueAt: null,
      now: new Date("2026-03-01T09:00:00Z"),
      record: null,
      recordedBy: null,
    });

    expect(item.availableAt).toBe(AVAILABLE_AT.toISOString());
    expect(item.dueAt).toBeNull();
    expect(item.status).toBe("pending");
  });
});

describe("Today contracts — removed M0 fields", () => {
  it("does not expose organizationId, timeZone, or Snapshot-suffixed keys on a Today row", () => {
    const keys = Object.keys(todayTaskItemSchema.shape);

    expect(keys).not.toContain("organizationId");
    expect(keys).not.toContain("timeZone");
    expect(keys.some((key) => key.endsWith("Snapshot"))).toBe(false);
  });
});
