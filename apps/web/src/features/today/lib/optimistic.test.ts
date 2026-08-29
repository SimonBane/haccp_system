import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { applyOptimisticRecord, applyOptimisticVoid } from "./optimistic";
import type { RecordMutationInput } from "./optimistic";

const DATE = "2026-01-15";
const USER = "00000000-0000-4000-8000-00000000user";
const TEMPLATE_A = "00000000-0000-4000-8000-00000000000a";
const OCCURRENCE_A = "00000000-0000-4000-8000-0000000occa";
const OCCURRENCE_B = "00000000-0000-4000-8000-0000000occb";
const NOW = new Date("2026-01-15T10:00:00.000Z");

function task(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  return {
    occurrenceId: OCCURRENCE_A,
    templateId: TEMPLATE_A,
    title: "Task",
    type: "cleaning",
    equipmentId: null,
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    scheduledTime: "07:00",
    timeSlot: "morning",
    date: DATE,
    availableAt: "2026-01-15T00:00:00.000Z",
    dueAt: "2026-01-15T07:00:00.000Z",
    recordState: "none",
    status: "pending",
    completedAt: null,
    completedBy: null,
    temperatureReading: null,
    ...overrides,
  };
}

function response(tasks: {
  morning?: TodayTaskItem[];
  afternoon?: TodayTaskItem[];
  evening?: TodayTaskItem[];
}): TodayResponse {
  return {
    date: DATE,
    locationId: "00000000-0000-4000-8000-0000000000loc",
    currentUserId: USER,
    sections: {
      morning: tasks.morning ?? [],
      afternoon: tasks.afternoon ?? [],
      evening: tasks.evening ?? [],
    },
  };
}

function ordinaryInput(occurrenceId: string): RecordMutationInput {
  return { occurrenceId, kind: "ordinary" };
}

describe("applyOptimisticRecord — ordinary", () => {
  it("marks the matching occurrence active and completed by the current user", () => {
    const before = response({ morning: [task()] });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    expect(after?.sections.morning[0]).toMatchObject({
      recordState: "active",
      status: "completed",
      completedAt: NOW.toISOString(),
      completedBy: { id: USER, firstName: "", lastName: "" },
    });
  });

  it("matches on occurrenceId only — same template/time rows cannot cross-patch", () => {
    const before = response({
      morning: [
        task({ occurrenceId: OCCURRENCE_A, scheduledTime: "07:00" }),
        task({ occurrenceId: OCCURRENCE_B, scheduledTime: "07:00" }),
      ],
    });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    expect(after?.sections.morning[0].recordState).toBe("active");
    expect(after?.sections.morning[1].recordState).toBe("none");
  });

  it("patches across whichever section holds the occurrence", () => {
    const before = response({
      evening: [task({ scheduledTime: "18:00", timeSlot: "evening" })],
    });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    expect(after?.sections.evening[0].status).toBe("completed");
  });

  it("returns the identical reference when nothing matched", () => {
    const before = response({ morning: [task()] });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_B), USER, NOW);

    // Same reference, so React Query does not notify subscribers for a no-op.
    expect(after).toBe(before);
  });

  it("leaves untouched rows referentially stable", () => {
    const other = task({ occurrenceId: OCCURRENCE_B, scheduledTime: "09:00" });
    const before = response({ morning: [task(), other] });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    expect(after?.sections.morning[1]).toBe(other);
  });

  it("passes undefined through", () => {
    expect(applyOptimisticRecord(undefined, ordinaryInput(OCCURRENCE_A), USER, NOW)).toBeUndefined();
  });

  it("does not mutate the previous response", () => {
    const before = response({ morning: [task()] });
    applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    // Rollback depends on the captured previous value staying pristine.
    expect(before.sections.morning[0].status).toBe("pending");
    expect(before.sections.morning[0].completedAt).toBeNull();
  });
});

describe("applyOptimisticVoid", () => {
  const completed = task({
    recordState: "active",
    status: "completed",
    completedAt: "2026-01-15T05:10:00.000Z",
    completedBy: { id: USER, firstName: "Ann", lastName: "Lee" },
    temperatureReading: {
      recordedC: 3,
      result: "ok",
      minTempC: 0,
      maxTempC: 5,
      correctiveAction: null,
    },
  });

  it("clears completion metadata and the reading, and marks recordState voided", () => {
    const before = response({ morning: [completed] });
    const after = applyOptimisticVoid(before, OCCURRENCE_A, NOW);

    expect(after?.sections.morning[0]).toMatchObject({
      recordState: "voided",
      completedAt: null,
      completedBy: null,
      temperatureReading: null,
    });
  });

  it("recomputes status as overdue once dueAt has passed", () => {
    const before = response({
      morning: [completed],
    });
    const after = applyOptimisticVoid(before, OCCURRENCE_A, NOW);

    // dueAt is 07:00Z on the base fixture; NOW is 10:00Z.
    expect(after?.sections.morning[0].status).toBe("overdue");
  });

  it("recomputes status as pending when dueAt is still ahead", () => {
    const evening = task({
      scheduledTime: "18:00",
      timeSlot: "evening",
      dueAt: "2026-01-15T18:00:00.000Z",
      recordState: "active",
      status: "completed",
      completedAt: "2026-01-15T05:10:00.000Z",
    });
    const before = response({ evening: [evening] });
    const after = applyOptimisticVoid(before, OCCURRENCE_A, NOW);

    expect(after?.sections.evening[0].status).toBe("pending");
  });

  it("returns the identical reference when nothing matched", () => {
    const before = response({ morning: [completed] });
    expect(applyOptimisticVoid(before, OCCURRENCE_B, NOW)).toBe(before);
  });

  it("recomputes status as pending, never overdue, for a no-deadline occurrence", () => {
    const noDeadline = task({
      dueAt: null,
      recordState: "active",
      status: "completed",
      completedAt: "2026-01-15T05:10:00.000Z",
    });
    const before = response({ morning: [noDeadline] });
    const after = applyOptimisticVoid(
      before,
      OCCURRENCE_A,
      new Date("2026-03-01T00:00:00.000Z"),
    );

    expect(after?.sections.morning[0].status).toBe("pending");
    expect(after?.sections.morning[0].dueAt).toBeNull();
  });
});

describe("applyOptimisticRecord — temperature", () => {
  const fridge = task({
    type: "temperature",
    equipmentId: "00000000-0000-4000-8000-0000000000eq",
    equipmentName: "Fridge 1",
    minTempC: 0,
    maxTempC: 5,
  });

  function temperatureInput(
    recordedC: number,
    correctiveAction?: string,
  ): RecordMutationInput {
    return { occurrenceId: OCCURRENCE_A, kind: "temperature", recordedC, correctiveAction };
  }

  it("classifies an in-range reading as ok", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(before, temperatureInput(3.2), USER, NOW);

    expect(after?.sections.morning[0].temperatureReading).toEqual({
      recordedC: 3.2,
      result: "ok",
      minTempC: 0,
      maxTempC: 5,
      correctiveAction: null,
    });
    expect(after?.sections.morning[0].status).toBe("completed");
    expect(after?.sections.morning[0].recordState).toBe("active");
  });

  it("classifies an out-of-range reading and keeps the corrective action", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(
      before,
      temperatureInput(9.5, "  Moved stock  "),
      USER,
      NOW,
    );

    expect(after?.sections.morning[0].temperatureReading).toEqual({
      recordedC: 9.5,
      result: "out_of_range",
      minTempC: 0,
      maxTempC: 5,
      correctiveAction: "Moved stock",
    });
  });

  it("drops a corrective action supplied with an in-range reading", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(before, temperatureInput(3, "not needed"), USER, NOW);

    expect(after?.sections.morning[0].temperatureReading?.correctiveAction).toBeNull();
  });

  it("treats the range bounds as inclusive", () => {
    const before = response({ morning: [fridge] });
    for (const recordedC of [0, 5]) {
      const after = applyOptimisticRecord(before, temperatureInput(recordedC), USER, NOW);
      expect(after?.sections.morning[0].temperatureReading?.result).toBe("ok");
    }
  });

  it("falls back to the previous reading's range when the task has none", () => {
    const noRange = task({
      type: "temperature",
      minTempC: null,
      maxTempC: null,
      temperatureReading: {
        recordedC: 2,
        result: "ok",
        minTempC: 1,
        maxTempC: 4,
        correctiveAction: null,
      },
    });
    const before = response({ morning: [noRange] });
    const after = applyOptimisticRecord(before, temperatureInput(9), USER, NOW);

    expect(after?.sections.morning[0].temperatureReading).toMatchObject({
      result: "out_of_range",
      minTempC: 1,
      maxTempC: 4,
    });
  });

  it("completes without guessing a reading when no range is known", () => {
    const noRange = task({ type: "temperature" });
    const before = response({ morning: [noRange] });
    const after = applyOptimisticRecord(before, temperatureInput(9), USER, NOW);

    // Better a missing reading for a moment than a wrong pass/fail on a HACCP log.
    expect(after?.sections.morning[0].status).toBe("completed");
    expect(after?.sections.morning[0].temperatureReading).toBeNull();
  });

  it("returns the identical reference when nothing matched", () => {
    const before = response({ morning: [fridge] });
    expect(
      applyOptimisticRecord(
        before,
        { occurrenceId: OCCURRENCE_B, kind: "temperature", recordedC: 3 },
        USER,
        NOW,
      ),
    ).toBe(before);
  });
});
