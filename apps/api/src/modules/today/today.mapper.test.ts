import { describe, expect, it } from "vitest";
import type { OccurrenceWithRecordRow } from "./today.repository.js";
import {
  sortItemsByScheduledTime,
  toTodayEntryItem,
  toTodayOnDemandForm,
  toTodayTaskItem,
} from "./today.mapper.js";
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
      recordId: null,
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
      deviationId: null,
      correctiveNote: null,
      correctiveAnswerIds: null,
      ...overrides,
    };
  }

  it("returns what was chosen and written about a failed check", () => {
    const item = toTodayTaskItem(
      occurrenceRow({
        recordId: "00000000-0000-4000-8000-0000000000c1",
        recordedAt: new Date("2026-01-15T07:10:00Z"),
        recordedByUserId: "00000000-0000-4000-8000-0000000000d1",
        result: "fail",
        values: {},
        correctiveAction: "Moved product, Door was open",
        deviationId: "00000000-0000-4000-8000-0000000000e9",
        correctiveNote: "Door was open",
        correctiveAnswerIds: ["a_moved"],
      }),
      NOW,
    );

    expect(item.corrective).toEqual({
      answerIds: ["a_moved"],
      note: "Door was open",
    });
    expect(toTodayTaskItem(occurrenceRow(), NOW).corrective).toBeNull();
  });

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

describe("toTodayEntryItem", () => {
  it("builds a completed on-demand item with its room and recorder", () => {
    const item = toTodayEntryItem({
      recordId: "00000000-0000-4000-8000-0000000000c1",
      title: "Cooling log",
      formVersionId: "00000000-0000-4000-8000-0000000000f1",
      targetId: "00000000-0000-4000-8000-00000000000e",
      targetName: "Blast chiller",
      targetKind: "equipment",
      targetLiveName: "Blast chiller",
      targetParentId: "00000000-0000-4000-8000-0000000000a2",
      targetParentName: "Kitchen",
      resolvedLimits: {},
      entryDate: "2026-01-15",
      entryTime: "14:40",
      createdAt: new Date("2026-01-15T12:45:00Z"),
      recordedAt: new Date("2026-01-15T12:45:00Z"),
      recordedByUserId: "00000000-0000-4000-8000-0000000000d1",
      recordedByFirstName: "Ann",
      recordedByLastName: null,
      result: "pass",
      values: {},
      correctiveAction: null,
      deviationId: null,
      correctiveNote: null,
      correctiveAnswerIds: null,
    });

    expect(item).toMatchObject({
      kind: "on_demand",
      occurrenceId: null,
      recordId: "00000000-0000-4000-8000-0000000000c1",
      scheduledTime: "14:40",
      status: "completed",
      area: { id: "00000000-0000-4000-8000-0000000000a2", name: "Kitchen" },
      completedBy: { firstName: "Ann", lastName: "" },
    });
  });
});

describe("toTodayOnDemandForm", () => {
  it("offers the latest version with the form's own limits", () => {
    const form = toTodayOnDemandForm({
      form: {
        id: "00000000-0000-4000-8000-0000000000f8",
        organizationId: "00000000-0000-4000-8000-0000000000o1",
        name: "Cooling log",
        category: "temperature",
        appliesTo: "per_item",
        onDemand: true,
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      latestVersion: {
        id: "00000000-0000-4000-8000-0000000000f9",
        formId: "00000000-0000-4000-8000-0000000000f8",
        version: 3,
        definition: {
          fields: [
            {
              id: "temperature",
              type: "measurement",
              label: "Core temperature",
              required: true,
              unit: "celsius",
              limits: { min: null, max: 5 },
            },
          ],
          correctiveAction: "optional",
        } as never,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    expect(form).toEqual({
      formId: "00000000-0000-4000-8000-0000000000f8",
      name: "Cooling log",
      formVersionId: "00000000-0000-4000-8000-0000000000f9",
      appliesTo: "per_item",
      resolvedLimits: { temperature: { min: null, max: 5 } },
    });
  });
});
