import type { FormDefinition, TaskTemplateResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  buildDefaultCompletionWindow,
  buildDefaultTargets,
  findDuplicateScheduledTimeIndices,
  getNextDefaultScheduledTime,
  hasTaskChanges,
  overrideIssueKey,
  toTargetInputs,
} from "./form-helpers";

const FRIDGE_ID = "00000000-0000-4000-8000-0000000000f1";
const FREEZER_ID = "00000000-0000-4000-8000-0000000000f2";

const FRIDGE_CHECK: FormDefinition = {
  correctiveAction: "required_on_fail",
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Temperature",
      required: true,
      unit: "celsius",
      limits: { min: 0, max: 4 },
    },
    { id: "door", type: "checkbox", label: "Door closed", required: true },
  ],
};

function makeTask(
  overrides: Partial<TaskTemplateResponse> = {},
): TaskTemplateResponse {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    locationId: "00000000-0000-4000-8000-000000000002",
    title: "Morning check",
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

describe("buildDefaultCompletionWindow", () => {
  it("leaves a new template's window unset so the admin must choose explicitly", () => {
    expect(buildDefaultCompletionWindow(null, null)).toEqual({
      completionOpensBeforeMinutes: "",
      completionDueAfterMinutes: "",
      neverOverdue: false,
    });
  });

  it("carries an existing task's window as strings", () => {
    const task = makeTask({
      completionOpensBeforeMinutes: 30,
      completionDueAfterMinutes: 60,
    });

    expect(buildDefaultCompletionWindow(task, null)).toEqual({
      completionOpensBeforeMinutes: "30",
      completionDueAfterMinutes: "60",
      neverOverdue: false,
    });
  });

  it("derives Never overdue from a null completionDueAfterMinutes", () => {
    const task = makeTask({ completionDueAfterMinutes: null });

    expect(buildDefaultCompletionWindow(task, null)).toEqual({
      completionOpensBeforeMinutes: "1440",
      completionDueAfterMinutes: "",
      neverOverdue: true,
    });
  });

  it("copies the duplicate source's window when duplicating", () => {
    const source = makeTask({
      completionOpensBeforeMinutes: 15,
      completionDueAfterMinutes: null,
    });

    expect(buildDefaultCompletionWindow(null, source)).toEqual({
      completionOpensBeforeMinutes: "15",
      completionDueAfterMinutes: "",
      neverOverdue: true,
    });
  });
});

describe("hasTaskChanges — completion window", () => {
  const task = makeTask({
    completionOpensBeforeMinutes: 30,
    completionDueAfterMinutes: 60,
  });

  const baseValues = {
    title: task.title,
    formId: task.formId,
    weekdays: task.weekdays,
    scheduledTimeRows: task.scheduledTimes.map((time) => ({ time })),
    targets: task.targets,
    completionOpensBeforeMinutes: "30",
    completionDueAfterMinutes: "60",
    neverOverdue: false,
  };

  it("is false when nothing changed", () => {
    expect(hasTaskChanges(baseValues, task)).toBe(false);
  });

  it("is true when the opening minutes changed", () => {
    expect(
      hasTaskChanges(
        { ...baseValues, completionOpensBeforeMinutes: "45" },
        task,
      ),
    ).toBe(true);
  });

  it("is true when the deadline minutes changed", () => {
    expect(
      hasTaskChanges({ ...baseValues, completionDueAfterMinutes: "90" }, task),
    ).toBe(true);
  });

  it("is true when Never overdue is toggled on, even if the stored minutes field is untouched", () => {
    expect(
      hasTaskChanges({ ...baseValues, neverOverdue: true }, task),
    ).toBe(true);
  });

  it("is false when toggling Never overdue matches an already-null stored deadline", () => {
    const neverOverdueTask = makeTask({
      completionOpensBeforeMinutes: 30,
      completionDueAfterMinutes: null,
    });

    expect(
      hasTaskChanges(
        { ...baseValues, neverOverdue: true, completionDueAfterMinutes: "" },
        neverOverdueTask,
      ),
    ).toBe(false);
  });
});

describe("findDuplicateScheduledTimeIndices", () => {
  it("returns an empty set when all times are unique", () => {
    expect(
      findDuplicateScheduledTimeIndices(["08:00", "09:00", "10:00"]),
    ).toEqual(new Set());
  });

  it("flags both indices of a colliding pair", () => {
    expect(
      findDuplicateScheduledTimeIndices(["08:00", "09:00", "08:00"]),
    ).toEqual(new Set([0, 2]));
  });

  it("flags every index when all rows share the same time", () => {
    expect(
      findDuplicateScheduledTimeIndices(["08:00", "08:00", "08:00", "08:00"]),
    ).toEqual(new Set([0, 1, 2, 3]));
  });

  it("ignores blank rows instead of treating them as duplicates", () => {
    expect(findDuplicateScheduledTimeIndices(["", "", "08:00"])).toEqual(
      new Set(),
    );
  });
});

describe("getNextDefaultScheduledTime", () => {
  it("defaults the first row to 08:00", () => {
    expect(getNextDefaultScheduledTime([])).toBe("08:00");
  });

  it("increments the previous row's hour", () => {
    expect(getNextDefaultScheduledTime(["08:00"])).toBe("09:00");
    expect(getNextDefaultScheduledTime(["08:00", "09:00"])).toBe("10:00");
  });

  it("wraps hour 23 to 00", () => {
    expect(getNextDefaultScheduledTime(["23:00"])).toBe("00:00");
  });
});

describe("buildDefaultTargets", () => {
  it("turns stored overrides into enabled drafts in the locale's separator", () => {
    const task = makeTask({
      targets: [
        {
          targetId: FREEZER_ID,
          targetName: "Freezer",
          limitOverrides: { temperature: { min: -22.5, max: null } },
        },
      ],
    });

    expect(buildDefaultTargets(task, null, ",")).toEqual([
      {
        targetId: FREEZER_ID,
        overrides: {
          temperature: { enabled: true, min: "-22,5", max: "" },
        },
      },
    ]);
  });
});

describe("toTargetInputs", () => {
  it("sends only enabled overrides for fields the form still measures", () => {
    const { targets, issues } = toTargetInputs(
      [
        {
          targetId: FRIDGE_ID,
          overrides: {
            temperature: { enabled: true, min: "1,5", max: "3" },
            humidity: { enabled: true, min: "40", max: "60" },
          },
        },
        {
          targetId: FREEZER_ID,
          overrides: { temperature: { enabled: false, min: "-25", max: "-18" } },
        },
      ],
      FRIDGE_CHECK,
    );

    expect(issues).toEqual({});
    expect(targets).toEqual([
      { targetId: FRIDGE_ID, limitOverrides: { temperature: { min: 1.5, max: 3 } } },
      { targetId: FREEZER_ID, limitOverrides: {} },
    ]);
  });

  it("reports an invalid override against its target and field", () => {
    const { targets, issues } = toTargetInputs(
      [
        {
          targetId: FRIDGE_ID,
          overrides: { temperature: { enabled: true, min: "5", max: "2" } },
        },
      ],
      FRIDGE_CHECK,
    );

    expect(issues).toEqual({
      [overrideIssueKey(FRIDGE_ID, "temperature")]: "order",
    });
    expect(targets[0]?.limitOverrides).toEqual({});
  });

  it("keeps the selection without overrides until a form is chosen", () => {
    expect(
      toTargetInputs([{ targetId: FRIDGE_ID, overrides: {} }], null).targets,
    ).toEqual([{ targetId: FRIDGE_ID, limitOverrides: {} }]);
  });
});

describe("hasTaskChanges — form and targets", () => {
  const task = makeTask({
    targets: [
      {
        targetId: FRIDGE_ID,
        targetName: "Fridge",
        limitOverrides: { temperature: { min: 0, max: 3 } },
      },
    ],
  });
  const values = {
    title: task.title,
    formId: task.formId,
    weekdays: task.weekdays,
    scheduledTimeRows: task.scheduledTimes.map((time) => ({ time })),
    targets: [
      {
        targetId: FRIDGE_ID,
        limitOverrides: { temperature: { min: 0, max: 3 } },
      },
    ],
    completionOpensBeforeMinutes: "1440",
    completionDueAfterMinutes: "0",
    neverOverdue: false,
  };

  it("is false for the same targets and overrides", () => {
    expect(hasTaskChanges(values, task)).toBe(false);
  });

  it("is true when an override changes or a target is added", () => {
    expect(
      hasTaskChanges(
        {
          ...values,
          targets: [
            { targetId: FRIDGE_ID, limitOverrides: { temperature: { min: 0, max: 4 } } },
          ],
        },
        task,
      ),
    ).toBe(true);
    expect(
      hasTaskChanges(
        {
          ...values,
          targets: [...values.targets, { targetId: FREEZER_ID, limitOverrides: {} }],
        },
        task,
      ),
    ).toBe(true);
  });

  it("is true when the form changes", () => {
    expect(
      hasTaskChanges(
        { ...values, formId: "00000000-0000-4000-8000-000000000009" },
        task,
      ),
    ).toBe(true);
  });
});
