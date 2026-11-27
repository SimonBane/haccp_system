import {
  RECORD_DISPLAY_STATE,
  RECORD_ENTRY_STATE,
  RECORD_KIND,
  RECORD_RESULT,
  RECORD_TIMING,
  type RecordItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  groupRecordsByDay,
  lateByMinutes,
  readingScale,
  recordCaption,
  recordHistory,
  recordReadings,
  shortAnswer,
} from "./record-view";
import {
  recordHeading,
  recordOutcome,
} from "./records-outcome";


const USER = { id: "55555555-5555-4555-8555-555555555555", firstName: "Maria", lastName: "Ivanova" };

/** A submitted, passed, on-time scheduled fridge reading at 08:00 with a 09:00 deadline. */
function recordItem(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    kind: RECORD_KIND.SCHEDULED,
    occurrenceId: "11111111-1111-4111-8111-111111111111",
    taskTemplateId: "22222222-2222-4222-8222-222222222222",
    entryDate: "2026-11-26",
    entryTime: "08:00",
    availableAt: "2026-11-26T06:00:00.000Z",
    dueAt: "2026-11-26T07:00:00.000Z",
    title: "Fridge temperature",
    formVersionId: "77777777-7777-4777-8777-777777777777",
    category: "temperature",
    targetId: "33333333-3333-4333-8333-333333333333",
    targetName: "Walk-in fridge",
    resolvedLimits: { temp: { min: 0, max: 4 } },
    displayState: RECORD_DISPLAY_STATE.SUBMITTED,
    recordState: RECORD_ENTRY_STATE.SUBMITTED,
    timing: RECORD_TIMING.ON_TIME,
    result: RECORD_RESULT.PASS,
    record: {
      recordId: "44444444-4444-4444-8444-444444444444",
      createdAt: "2026-11-26T06:05:00.000Z",
      createdBy: USER,
      recordedAt: "2026-11-26T06:05:00.000Z",
      recordedBy: USER,
      voidedAt: null,
      voidedBy: null,
      values: {
        temp: { type: "measurement", value: 3.2, unit: "celsius", min: 0, max: 4, fails: false },
      },
      correctiveAction: null,
    },
    ...overrides,
  };
}

/** A scheduled check nobody recorded before its deadline. */
function missedItem(overrides: Partial<RecordItem> = {}): RecordItem {
  return recordItem({
    id: "99999999-9999-4999-8999-999999999999",
    displayState: RECORD_DISPLAY_STATE.MISSED,
    recordState: RECORD_ENTRY_STATE.NONE,
    timing: RECORD_TIMING.NOT_SUBMITTED,
    result: RECORD_RESULT.NOT_EVALUATED,
    record: null,
    ...overrides,
  });
}


describe("record outcome", () => {
  it("reads a submitted record by its result", () => {
    expect(recordOutcome(recordItem())).toBe("passed");
    expect(recordOutcome(recordItem({ result: RECORD_RESULT.FAIL }))).toBe("attention");
    expect(recordOutcome(recordItem({ result: RECORD_RESULT.NOT_EVALUATED }))).toBe("recorded");
  });

  it("reads missed, voided and open rows by their state", () => {
    expect(recordOutcome(missedItem())).toBe("missed");
    expect(recordOutcome(recordItem({ displayState: RECORD_DISPLAY_STATE.VOIDED, result: RECORD_RESULT.FAIL }))).toBe("voided");
    expect(recordOutcome(missedItem({ displayState: RECORD_DISPLAY_STATE.OPEN, dueAt: null }))).toBe("open");
  });


  it("leads with the item, falling back to the form for a whole-location check", () => {
    expect(recordHeading(recordItem())).toEqual({ primary: "Walk-in fridge", secondary: "Fridge temperature" });
    expect(recordHeading(recordItem({ targetName: null }))).toEqual({ primary: "Fridge temperature", secondary: null });
  });
});

describe("day groups", () => {
  it("splits newest-first rows at each date and counts the exceptions", () => {
    const groups = groupRecordsByDay([
      recordItem({ id: "a", result: RECORD_RESULT.FAIL }),
      recordItem({ id: "b" }),
      missedItem({ id: "c", entryDate: "2026-11-25" }),
      missedItem({ id: "d", entryDate: "2026-11-25", displayState: RECORD_DISPLAY_STATE.OPEN, dueAt: null }),
    ]);

    expect(groups.map((group) => [group.date, group.items.length, group.attention, group.missed, group.open])).toEqual([
      ["2026-11-26", 2, 1, 0, 0],
      ["2026-11-25", 2, 0, 1, 1],
    ]);
  });
});

describe("readings", () => {
  it("lists measurements with a value and the limits they were judged against", () => {
    expect(recordReadings(recordItem(), null)).toEqual([
      { fieldId: "temp", label: "temp", value: 3.2, unit: "celsius", limits: { min: 0, max: 4 }, fails: false },
    ]);
    expect(recordReadings(missedItem(), null)).toEqual([]);
  });

  it("places the band and the reading on a bar with room either side", () => {
    const scale = readingScale({ value: 3.2, limits: { min: 0, max: 4 } })!;
    expect(scale.bandStart).toBeCloseTo(25);
    expect(scale.bandEnd).toBeCloseTo(75);
    expect(scale.marker).toBeCloseTo(65);
    expect(scale.ticks.map((tick) => tick.value)).toEqual([0, 4]);
  });

  it("opens a one-sided band to the bar's end and keeps an outlier on the bar", () => {
    const scale = readingScale({ value: -12, limits: { min: null, max: -18 } })!;
    expect(scale.bandStart).toBe(0);
    expect(scale.marker).toBeLessThanOrEqual(98);
    expect(scale.ticks).toHaveLength(1);
    expect(readingScale({ value: 1, limits: { min: null, max: null } })).toBeNull();
  });
});

describe("history", () => {
  it("shows the schedule and an on-time recording", () => {
    expect(recordHistory(recordItem()).map((event) => [event.kind, event.timing])).toEqual([
      ["scheduled", null],
      ["recorded", "on_time"],
    ]);
  });

  it("adds a corrective action, a late recording and a void", () => {
    const item = recordItem({
      displayState: RECORD_DISPLAY_STATE.VOIDED,
      record: {
        ...recordItem().record!,
        recordedAt: "2026-11-26T07:25:00.000Z",
        createdAt: "2026-11-26T07:25:00.000Z",
        correctiveAction: "Moved the meat",
        voidedAt: "2026-11-26T07:30:00.000Z",
      },
    });
    expect(recordHistory(item).map((event) => [event.kind, event.timing])).toEqual([
      ["scheduled", null],
      ["recorded", "late"],
      ["correctiveAction", null],
      ["voided", null],
    ]);
  });

  it("shows both steps of a record edited later, and a missed check's close", () => {
    const edited = recordItem({ record: { ...recordItem().record!, recordedAt: "2026-11-26T06:30:00.000Z" } });
    expect(recordHistory(edited).map((event) => event.kind)).toEqual(["scheduled", "recorded", "updated"]);
    expect(recordHistory(missedItem()).map((event) => event.kind)).toEqual(["scheduled", "missed"]);
  });

  it("gives an on-demand entry no schedule or timing", () => {
    const events = recordHistory(recordItem({ kind: RECORD_KIND.ON_DEMAND, dueAt: null }));
    expect(events.map((event) => [event.kind, event.timing])).toEqual([["recorded", null]]);
  });
});

describe("phone captions and short answers", () => {
  it("names the deadline of a missed check, a corrective action, then lateness", () => {
    expect(recordCaption(missedItem())).toEqual({ kind: "wasDue", at: "2026-11-26T07:00:00.000Z" });
    expect(
      recordCaption(recordItem({ result: RECORD_RESULT.FAIL, record: { ...recordItem().record!, correctiveAction: "Called service" } })),
    ).toEqual({ kind: "correctiveAction" });
    const late = recordItem({ timing: RECORD_TIMING.LATE, record: { ...recordItem().record!, recordedAt: "2026-11-26T07:25:00.000Z" } });
    expect(lateByMinutes(late)).toBe(25);
    expect(recordCaption(late)).toEqual({ kind: "late", minutes: 25 });
    expect(recordCaption(recordItem())).toBeNull();
  });

  it("shows the reading, else how much of a checklist was done", () => {
    expect(shortAnswer(recordItem())).toEqual({ kind: "reading", value: 3.2, unit: "celsius" });
    expect(
      shortAnswer(
        recordItem({
          record: {
            ...recordItem().record!,
            values: { a: { type: "checkbox", value: true }, b: { type: "checkbox", value: false } },
          },
        }),
      ),
    ).toEqual({ kind: "checklist", done: 1, total: 2 });
    expect(shortAnswer(missedItem())).toBeNull();
  });
});
