import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  applyOptimisticCompletion,
  applyOptimisticTemperature,
  applyOptimisticUncompletion,
} from "./optimistic";

/**
 * The optimistic patches are what make a tap feel instant on a kitchen tablet,
 * and they are the reason Today cannot simply be put on a refetch interval: a
 * poll landing between the local patch and the server confirm would flash a
 * completed row back to incomplete. Pin the behaviour before touching refetch.
 */
const SOFIA = "Europe/Sofia";
const DATE = "2026-01-15";
const USER = "00000000-0000-4000-8000-00000000user";
const TEMPLATE_A = "00000000-0000-4000-8000-00000000000a";
const TEMPLATE_B = "00000000-0000-4000-8000-00000000000b";
const NOW = new Date("2026-01-15T10:00:00.000Z");

function task(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  return {
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

describe("applyOptimisticCompletion", () => {
  it("marks the matching occurrence completed by the current user", () => {
    const before = response({ morning: [task()] });
    const after = applyOptimisticCompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00" },
      USER,
      NOW,
    );

    expect(after?.sections.morning[0]).toMatchObject({
      status: "completed",
      completedAt: NOW.toISOString(),
      completedBy: { id: USER, firstName: "", lastName: "" },
    });
  });

  it("matches on templateId AND scheduledTime, not just the template", () => {
    const before = response({
      morning: [task({ scheduledTime: "07:00" })],
      afternoon: [task({ scheduledTime: "12:00", timeSlot: "afternoon" })],
    });
    const after = applyOptimisticCompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "12:00" },
      USER,
      NOW,
    );

    expect(after?.sections.morning[0].status).toBe("pending");
    expect(after?.sections.afternoon[0].status).toBe("completed");
  });

  it("patches across whichever section holds the occurrence", () => {
    const before = response({
      evening: [task({ scheduledTime: "18:00", timeSlot: "evening" })],
    });
    const after = applyOptimisticCompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "18:00" },
      USER,
      NOW,
    );

    expect(after?.sections.evening[0].status).toBe("completed");
  });

  it("returns the identical reference when nothing matched", () => {
    const before = response({ morning: [task()] });
    const after = applyOptimisticCompletion(
      before,
      { templateId: TEMPLATE_B, date: DATE, scheduledTime: "07:00" },
      USER,
      NOW,
    );

    // Same reference, so React Query does not notify subscribers for a no-op.
    expect(after).toBe(before);
  });

  it("leaves untouched rows referentially stable", () => {
    const other = task({ templateId: TEMPLATE_B, scheduledTime: "09:00" });
    const before = response({ morning: [task(), other] });
    const after = applyOptimisticCompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00" },
      USER,
      NOW,
    );

    expect(after?.sections.morning[1]).toBe(other);
  });

  it("passes undefined through", () => {
    expect(
      applyOptimisticCompletion(
        undefined,
        { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00" },
        USER,
        NOW,
      ),
    ).toBeUndefined();
  });

  it("does not mutate the previous response", () => {
    const before = response({ morning: [task()] });
    applyOptimisticCompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00" },
      USER,
      NOW,
    );

    // Rollback depends on the captured previous value staying pristine.
    expect(before.sections.morning[0].status).toBe("pending");
    expect(before.sections.morning[0].completedAt).toBeNull();
  });
});

describe("applyOptimisticUncompletion", () => {
  const completed = task({
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

  it("clears completion metadata and the reading", () => {
    const before = response({ morning: [completed] });
    const after = applyOptimisticUncompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00" },
      SOFIA,
      NOW,
    );

    expect(after?.sections.morning[0]).toMatchObject({
      completedAt: null,
      completedBy: null,
      temperatureReading: null,
    });
  });

  it("recomputes status as overdue when the round has already passed", () => {
    // 10:00Z is 12:00 in Sofia, well past a 07:00 round.
    const before = response({ morning: [completed] });
    const after = applyOptimisticUncompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00" },
      SOFIA,
      NOW,
    );

    expect(after?.sections.morning[0].status).toBe("overdue");
  });

  it("recomputes status as pending when the round is still ahead", () => {
    const evening = task({
      scheduledTime: "18:00",
      timeSlot: "evening",
      status: "completed",
      completedAt: "2026-01-15T05:10:00.000Z",
    });
    const before = response({ evening: [evening] });
    const after = applyOptimisticUncompletion(
      before,
      { templateId: TEMPLATE_A, date: DATE, scheduledTime: "18:00" },
      SOFIA,
      NOW,
    );

    expect(after?.sections.evening[0].status).toBe("pending");
  });

  it("returns the identical reference when nothing matched", () => {
    const before = response({ morning: [completed] });
    expect(
      applyOptimisticUncompletion(
        before,
        { templateId: TEMPLATE_B, date: DATE, scheduledTime: "07:00" },
        SOFIA,
        NOW,
      ),
    ).toBe(before);
  });
});

describe("applyOptimisticTemperature", () => {
  const fridge = task({
    type: "temperature",
    equipmentId: "00000000-0000-4000-8000-0000000000eq",
    equipmentName: "Fridge 1",
    minTempC: 0,
    maxTempC: 5,
  });

  it("classifies an in-range reading as ok", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticTemperature(
      before,
      {
        templateId: TEMPLATE_A,
        date: DATE,
        scheduledTime: "07:00",
        recordedC: 3.2,
      },
      USER,
      NOW,
    );

    expect(after?.sections.morning[0].temperatureReading).toEqual({
      recordedC: 3.2,
      result: "ok",
      minTempC: 0,
      maxTempC: 5,
      correctiveAction: null,
    });
    expect(after?.sections.morning[0].status).toBe("completed");
  });

  it("classifies an out-of-range reading and keeps the corrective action", () => {
    const before = response({ morning: [fridge] });
    const after = applyOptimisticTemperature(
      before,
      {
        templateId: TEMPLATE_A,
        date: DATE,
        scheduledTime: "07:00",
        recordedC: 9.5,
        correctiveAction: "  Moved stock  ",
      },
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
    const after = applyOptimisticTemperature(
      before,
      {
        templateId: TEMPLATE_A,
        date: DATE,
        scheduledTime: "07:00",
        recordedC: 3,
        correctiveAction: "not needed",
      },
      USER,
      NOW,
    );

    expect(
      after?.sections.morning[0].temperatureReading?.correctiveAction,
    ).toBeNull();
  });

  it("treats the range bounds as inclusive", () => {
    const before = response({ morning: [fridge] });
    for (const recordedC of [0, 5]) {
      const after = applyOptimisticTemperature(
        before,
        { templateId: TEMPLATE_A, date: DATE, scheduledTime: "07:00", recordedC },
        USER,
        NOW,
      );
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
    const after = applyOptimisticTemperature(
      before,
      {
        templateId: TEMPLATE_A,
        date: DATE,
        scheduledTime: "07:00",
        recordedC: 9,
      },
      USER,
      NOW,
    );

    expect(after?.sections.morning[0].temperatureReading).toMatchObject({
      result: "out_of_range",
      minTempC: 1,
      maxTempC: 4,
    });
  });

  it("completes without guessing a reading when no range is known", () => {
    const noRange = task({ type: "temperature" });
    const before = response({ morning: [noRange] });
    const after = applyOptimisticTemperature(
      before,
      {
        templateId: TEMPLATE_A,
        date: DATE,
        scheduledTime: "07:00",
        recordedC: 9,
      },
      USER,
      NOW,
    );

    // Better a missing reading for a moment than a wrong pass/fail on a HACCP log.
    expect(after?.sections.morning[0].status).toBe("completed");
    expect(after?.sections.morning[0].temperatureReading).toBeNull();
  });

  it("returns the identical reference when nothing matched", () => {
    const before = response({ morning: [fridge] });
    expect(
      applyOptimisticTemperature(
        before,
        {
          templateId: TEMPLATE_B,
          date: DATE,
          scheduledTime: "07:00",
          recordedC: 3,
        },
        USER,
        NOW,
      ),
    ).toBe(before);
  });
});
