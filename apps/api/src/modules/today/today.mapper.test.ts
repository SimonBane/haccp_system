import { describe, expect, it } from "vitest";
import type { OccurrenceWithRecordRow } from "./today.repository.js";
import { sortItemsByScheduledTime, toTodayTaskItem } from "./today.mapper.js";
import type { TodayTaskItem } from "@haccp/shared";

const OCCURRENCE_A = "00000000-0000-4000-8000-00000000000a";
const OCCURRENCE_B = "00000000-0000-4000-8000-00000000000b";

describe("sortItemsByScheduledTime", () => {
  const item = (
    scheduledTime: string,
    occurrenceId = OCCURRENCE_A,
    targetName: string | null = null,
    title = "Check",
  ): TodayTaskItem =>
    ({ scheduledTime, occurrenceId, targetName, title }) as TodayTaskItem;

  it("orders by clock time, not string order", () => {
    // Lexical "09:00" > "12:00"; clock order must put 9am first.
    const sorted = sortItemsByScheduledTime([
      item("12:00"),
      item("09:00"),
      item("07:30"),
    ]);

    expect(sorted.map((i) => i.scheduledTime)).toEqual([
      "07:30",
      "09:00",
      "12:00",
    ]);
  });

  it("breaks a same-time tie by occurrenceId", () => {
    const sorted = sortItemsByScheduledTime([
      item("07:00", OCCURRENCE_B),
      item("07:00", OCCURRENCE_A),
    ]);

    expect(sorted.map((i) => i.occurrenceId)).toEqual([
      OCCURRENCE_A,
      OCCURRENCE_B,
    ]);
  });

  it("keeps a room's fixtures together across tasks at the same time", () => {
    const sorted = sortItemsByScheduledTime([
      item("22:00", OCCURRENCE_A, "Kitchen 2 › Walls", "Weekly walls"),
      item("22:00", OCCURRENCE_A, "Bar › Floor", "Daily floors"),
      item("22:00", OCCURRENCE_B, "Kitchen 2 › Floor", "Daily floors"),
      item("22:00", OCCURRENCE_B, null, "Closing checklist"),
    ]);

    expect(sorted.map((i) => i.targetName)).toEqual([
      null,
      "Bar › Floor",
      "Kitchen 2 › Floor",
      "Kitchen 2 › Walls",
    ]);
  });

  it("does not mutate the input", () => {
    const input = [item("12:00"), item("07:00")];
    sortItemsByScheduledTime(input);

    expect(input.map((i) => i.scheduledTime)).toEqual(["12:00", "07:00"]);
  });
});

describe("toTodayTaskItem", () => {
  const NOW = new Date("2026-01-15T08:00:00Z");

  function occurrenceRow(
    overrides: Partial<OccurrenceWithRecordRow> = {},
  ): OccurrenceWithRecordRow {
    return {
      occurrenceId: OCCURRENCE_A,
      taskTemplateId: "00000000-0000-4000-8000-00000000000t",
      title: "Check walk-in fridge",
      formVersionId: "00000000-0000-4000-8000-0000000000f1",
      targetId: "00000000-0000-4000-8000-00000000000e",
      targetName: "Walk-in fridge",
      targetKind: "equipment",
      targetLiveName: "Walk-in fridge",
      targetParentId: null,
      targetParentName: null,
      resolvedLimits: { temperature: { min: 0, max: 5 } },
      scheduledTime: "07:00",
      occurrenceDate: "2026-01-15",
      availableAt: new Date("2026-01-15T00:00:00Z"),
      dueAt: new Date("2026-01-15T07:00:00Z"),
      recordedAt: null,
      recordedByUserId: null,
      recordedByFirstName: null,
      recordedByLastName: null,
      voidedAt: null,
      result: null,
      values: null,
      correctiveAction: null,
      ...overrides,
    };
  }

  it("puts a check in its room: the area itself, or the area holding the item", () => {
    const KITCHEN = "00000000-0000-4000-8000-0000000000a2";

    expect(toTodayTaskItem(occurrenceRow(), NOW).area).toBeNull();
    expect(
      toTodayTaskItem(
        occurrenceRow({
          targetId: KITCHEN,
          targetKind: "area",
          targetName: "Kitchen",
          targetLiveName: "Main kitchen",
        }),
        NOW,
      ).area,
    ).toEqual({ id: KITCHEN, name: "Main kitchen" });
    expect(
      toTodayTaskItem(
        occurrenceRow({
          targetKind: "fixture",
          targetName: "Kitchen › Walls",
          targetLiveName: "Walls",
          targetParentId: KITCHEN,
          targetParentName: "Kitchen",
        }),
        NOW,
      ),
    ).toMatchObject({
      targetKind: "fixture",
      area: { id: KITCHEN, name: "Kitchen" },
    });
    expect(
      toTodayTaskItem(
        occurrenceRow({
          targetId: null,
          targetName: null,
          targetKind: null,
          targetLiveName: null,
        }),
        NOW,
      ).area,
    ).toBeNull();
  });

  it("maps an unrecorded occurrence to recordState none and status overdue past dueAt", () => {
    const item = toTodayTaskItem(occurrenceRow(), NOW);

    expect(item.occurrenceId).toBe(OCCURRENCE_A);
    expect(item.recordState).toBe("none");
    expect(item.status).toBe("overdue");
    expect(item.completedAt).toBeNull();
    expect(item.completedBy).toBeNull();
    expect(item.result).toBeNull();
    expect(item.targetName).toBe("Walk-in fridge");
    expect(item.resolvedLimits).toEqual({ temperature: { min: 0, max: 5 } });
  });

  it("maps an unopened occurrence to status upcoming before availableAt", () => {
    const item = toTodayTaskItem(
      occurrenceRow({ availableAt: new Date("2026-01-15T09:00:00Z") }),
      NOW,
    );

    expect(item.status).toBe("upcoming");
  });

  it("maps a no-deadline occurrence to pending, never overdue, and a null dueAt", () => {
    const item = toTodayTaskItem(
      occurrenceRow({ dueAt: null }),
      new Date("2026-06-01T00:00:00Z"),
    );

    expect(item.status).toBe("pending");
    expect(item.dueAt).toBeNull();
  });

  it("maps an active record to recordState active with its answers", () => {
    const row = occurrenceRow({
      recordedAt: new Date("2026-01-15T07:05:00Z"),
      recordedByUserId: "00000000-0000-4000-8000-00000000000u",
      recordedByFirstName: "Ann",
      recordedByLastName: "Lee",
      voidedAt: null,
      result: "pass",
      values: {
        temperature: {
          type: "measurement",
          value: 3.1,
          unit: "celsius",
          min: 0,
          max: 5,
          fails: false,
        },
      },
      correctiveAction: null,
    });

    const item = toTodayTaskItem(row, NOW);

    expect(item.recordState).toBe("active");
    expect(item.status).toBe("completed");
    expect(item.completedAt).toBe("2026-01-15T07:05:00.000Z");
    expect(item.completedBy).toEqual({
      id: "00000000-0000-4000-8000-00000000000u",
      firstName: "Ann",
      lastName: "Lee",
    });
    expect(item.result).toBe("pass");
    expect(item.values?.temperature).toMatchObject({
      value: 3.1,
      fails: false,
    });
  });

  it("renders a voided record as uncompleted and does not expose its old answers", () => {
    const row = occurrenceRow({
      recordedAt: new Date("2026-01-15T07:05:00Z"),
      recordedByUserId: "00000000-0000-4000-8000-00000000000u",
      recordedByFirstName: "Ann",
      recordedByLastName: "Lee",
      voidedAt: new Date("2026-01-15T07:10:00Z"),
      result: "pass",
      values: {
        temperature: {
          type: "measurement",
          value: 3.1,
          unit: "celsius",
          min: 0,
          max: 5,
          fails: false,
        },
      },
      correctiveAction: null,
    });

    const item = toTodayTaskItem(row, NOW);

    expect(item.recordState).toBe("voided");
    expect(item.completedAt).toBeNull();
    expect(item.completedBy).toBeNull();
    expect(item.result).toBeNull();
    expect(item.values).toBeNull();
  });
});
