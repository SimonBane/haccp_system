import type { TaskTemplateResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  applyTargetSelection,
  buildDefaultTargets,
  hasTaskChanges,
} from "./form-helpers";

const FRIDGE_ID = "00000000-0000-4000-8000-0000000000f1";
const FREEZER_ID = "00000000-0000-4000-8000-0000000000f2";

function makeTask(
  overrides: Partial<TaskTemplateResponse> = {},
): TaskTemplateResponse {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    locationId: "00000000-0000-4000-8000-000000000002",
    formId: "00000000-0000-4000-8000-000000000003",
    formName: "Fridge check",
    formCategory: "temperature",
    weekdays: ["monday"],
    scheduledTimes: ["08:00"],
    targets: [],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDefaultTargets", () => {
  it("selects the saved task's items, or a duplicate source's", () => {
    const task = makeTask({
      targets: [{ targetId: FRIDGE_ID, targetName: "Fridge" }],
    });

    expect(buildDefaultTargets(task, null)).toEqual([{ targetId: FRIDGE_ID }]);
    expect(buildDefaultTargets(null, task)).toEqual([{ targetId: FRIDGE_ID }]);
    expect(buildDefaultTargets(null, null)).toEqual([]);
  });
});

describe("applyTargetSelection", () => {
  it("keeps the picked order", () => {
    expect(applyTargetSelection([FREEZER_ID, FRIDGE_ID])).toEqual([
      { targetId: FREEZER_ID },
      { targetId: FRIDGE_ID },
    ]);
  });
});

describe("hasTaskChanges", () => {
  const task = makeTask({
    weekdays: ["monday", "tuesday"],
    scheduledTimes: ["08:00", "14:00"],
    completionOpensBeforeMinutes: 30,
    completionDueAfterMinutes: 60,
    targets: [{ targetId: FRIDGE_ID, targetName: "Fridge" }],
  });
  const payload = {
    formId: task.formId,
    weekdays: ["tuesday", "monday"] as TaskTemplateResponse["weekdays"],
    scheduledTimes: ["14:00", "08:00"],
    targets: [{ targetId: FRIDGE_ID }],
    completionOpensBeforeMinutes: 30,
    completionDueAfterMinutes: 60,
  };

  it("is false for the same values in any order", () => {
    expect(hasTaskChanges(payload, task)).toBe(false);
  });

  it("is true when a target is added or swapped", () => {
    expect(
      hasTaskChanges(
        { ...payload, targets: [...payload.targets, { targetId: FREEZER_ID }] },
        task,
      ),
    ).toBe(true);
    expect(
      hasTaskChanges({ ...payload, targets: [{ targetId: FREEZER_ID }] }, task),
    ).toBe(true);
  });

  it("is true when a time is added or the window is removed", () => {
    expect(
      hasTaskChanges({ ...payload, scheduledTimes: [...payload.scheduledTimes, "20:00"] }, task),
    ).toBe(true);
    expect(
      hasTaskChanges(
        { ...payload, completionOpensBeforeMinutes: 1440, completionDueAfterMinutes: null },
        task,
      ),
    ).toBe(true);
  });
});
