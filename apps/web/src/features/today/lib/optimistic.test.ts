import type {
  FormDefinition,
  TodayResponse,
  TodayTaskItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { applyOptimisticRecord, applyOptimisticVoid } from "./optimistic";
import type { RecordMutationInput } from "./optimistic";

const DATE = "2026-01-15";
const USER = "00000000-0000-4000-8000-00000000user";
const TEMPLATE_A = "00000000-0000-4000-8000-00000000000a";
const OCCURRENCE_A = "00000000-0000-4000-8000-0000000occa";
const OCCURRENCE_B = "00000000-0000-4000-8000-0000000occb";
const NOW = new Date("2026-01-15T10:00:00.000Z");
const CLEANING_VERSION = "00000000-0000-4000-8000-0000000000c1";
const FRIDGE_VERSION = "00000000-0000-4000-8000-0000000000c2";

const CLEANING: FormDefinition = {
  correctiveAction: "optional",
  fields: [{ id: "cleaned", type: "checkbox", label: "Cleaned", required: true }],
};

const FRIDGE_CHECK: FormDefinition = {
  correctiveAction: "required_on_fail",
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Temperature",
      required: true,
      unit: "celsius",
      limits: { min: 0, max: 8 },
    },
  ],
};

function summary(id: string, definition: FormDefinition) {
  return {
    id,
    formId: "00000000-0000-4000-8000-0000000000f0",
    formName: "Form",
    category: "other" as const,
    version: 1,
    definition,
  };
}

function task(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  return {
    occurrenceId: OCCURRENCE_A,
    templateId: TEMPLATE_A,
    title: "Task",
    formVersionId: CLEANING_VERSION,
    targetId: null,
    targetName: null,
    resolvedLimits: {},
    scheduledTime: "07:00",
    timeSlot: "morning",
    date: DATE,
    availableAt: "2026-01-15T00:00:00.000Z",
    dueAt: "2026-01-15T07:00:00.000Z",
    recordState: "none",
    status: "pending",
    completedAt: null,
    completedBy: null,
    result: null,
    values: null,
    correctiveAction: null,
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
    formVersions: {
      [CLEANING_VERSION]: summary(CLEANING_VERSION, CLEANING),
      [FRIDGE_VERSION]: summary(FRIDGE_VERSION, FRIDGE_CHECK),
    },
    sections: {
      morning: tasks.morning ?? [],
      afternoon: tasks.afternoon ?? [],
      evening: tasks.evening ?? [],
    },
  };
}

function ordinaryInput(occurrenceId: string): RecordMutationInput {
  return { occurrenceId, values: { cleaned: true } };
}

describe("applyOptimisticRecord — completion", () => {
  it("marks the matching occurrence active and completed by the current user", () => {
    const before = response({ morning: [task()] });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    expect(after?.sections.morning[0]).toMatchObject({
      recordState: "active",
      status: "completed",
      completedAt: NOW.toISOString(),
      completedBy: { id: USER, firstName: "", lastName: "" },
      result: "not_evaluated",
      values: { cleaned: { type: "checkbox", value: true } },
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
    result: "not_evaluated",
    values: { cleaned: { type: "checkbox", value: true } },
  });

  it("clears completion metadata and the answers, and marks recordState voided", () => {
    const before = response({ morning: [completed] });
    const after = applyOptimisticVoid(before, OCCURRENCE_A, NOW);

    expect(after?.sections.morning[0]).toMatchObject({
      recordState: "voided",
      completedAt: null,
      completedBy: null,
      result: null,
      values: null,
      correctiveAction: null,
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

describe("applyOptimisticRecord — judged answers", () => {
  const fridge = task({
    formVersionId: FRIDGE_VERSION,
    targetId: "00000000-0000-4000-8000-0000000000eq",
    targetName: "Fridge 1",
    // The occurrence's own limits, narrower than the form's 0–8 default.
    resolvedLimits: { temperature: { min: 0, max: 5 } },
  });

  function reading(
    temperature: number,
    correctiveAction?: string,
  ): RecordMutationInput {
    return {
      occurrenceId: OCCURRENCE_A,
      values: { temperature },
      ...(correctiveAction === undefined ? {} : { correctiveAction }),
    };
  }

  it("passes an in-range reading against the occurrence's limits", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(before, reading(3.2), USER, NOW);

    expect(after?.sections.morning[0]).toMatchObject({
      result: "pass",
      values: {
        temperature: {
          type: "measurement",
          value: 3.2,
          unit: "celsius",
          min: 0,
          max: 5,
          fails: false,
        },
      },
      correctiveAction: null,
      status: "completed",
      recordState: "active",
    });
  });

  it("fails a reading inside the form default but outside the occurrence's override", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(
      before,
      reading(6, "  Moved stock  "),
      USER,
      NOW,
    );

    expect(after?.sections.morning[0]).toMatchObject({
      result: "fail",
      correctiveAction: "Moved stock",
    });
  });

  it("drops a corrective action supplied with a passing record", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(before, reading(3, "not needed"), USER, NOW);

    expect(after?.sections.morning[0]?.correctiveAction).toBeNull();
  });

  it("treats the limits as inclusive", () => {
    const before = response({ morning: [fridge] });
    for (const temperature of [0, 5]) {
      const after = applyOptimisticRecord(before, reading(temperature), USER, NOW);
      expect(after?.sections.morning[0]?.result).toBe("pass");
    }
  });

  it("completes without guessing a result when the answers would be rejected", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticRecord(
      before,
      { occurrenceId: OCCURRENCE_A, values: { temperature: "warm" } },
      USER,
      NOW,
    );

    // Better a missing result for a moment than a wrong pass/fail on a HACCP log.
    expect(after?.sections.morning[0]).toMatchObject({
      status: "completed",
      result: null,
      values: null,
    });
  });

  it("completes without guessing when the form version is unknown", () => {
    const orphan = task({ formVersionId: "00000000-0000-4000-8000-0000000000ff" });
    const before = response({ morning: [orphan] });
    const after = applyOptimisticRecord(before, ordinaryInput(OCCURRENCE_A), USER, NOW);

    expect(after?.sections.morning[0]).toMatchObject({
      status: "completed",
      result: null,
    });
  });
});
