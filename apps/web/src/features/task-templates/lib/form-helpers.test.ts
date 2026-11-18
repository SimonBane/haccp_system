import {
  getMeasurementFields,
  type FormDefinition,
  type TaskTemplateResponse,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  applyTargetSelection,
  buildDefaultTargets,
  countTargetsWithCustomLimits,
  hasTaskChanges,
  overrideIssueKey,
  patchOwnLimit,
  setOwnLimits,
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

describe("hasTaskChanges", () => {
  const task = makeTask({
    weekdays: ["monday", "tuesday"],
    scheduledTimes: ["08:00", "14:00"],
    completionOpensBeforeMinutes: 30,
    completionDueAfterMinutes: 60,
    targets: [
      {
        targetId: FRIDGE_ID,
        targetName: "Fridge",
        limitOverrides: { temperature: { min: 0, max: 3 } },
      },
    ],
  });
  const payload = {
    title: task.title,
    formId: task.formId,
    weekdays: ["tuesday", "monday"] as TaskTemplateResponse["weekdays"],
    scheduledTimes: ["14:00", "08:00"],
    targets: [
      { targetId: FRIDGE_ID, limitOverrides: { temperature: { min: 0, max: 3 } } },
    ],
    completionOpensBeforeMinutes: 30,
    completionDueAfterMinutes: 60,
  };

  it("is false for the same values in any order", () => {
    expect(hasTaskChanges(payload, task)).toBe(false);
  });

  it("is true when an override changes or a target is added", () => {
    expect(
      hasTaskChanges(
        {
          ...payload,
          targets: [
            { targetId: FRIDGE_ID, limitOverrides: { temperature: { min: 0, max: 4 } } },
          ],
        },
        task,
      ),
    ).toBe(true);
    expect(
      hasTaskChanges(
        { ...payload, targets: [...payload.targets, { targetId: FREEZER_ID, limitOverrides: {} }] },
        task,
      ),
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

describe("setOwnLimits and patchOwnLimit", () => {
  const fields = getMeasurementFields(FRIDGE_CHECK);
  const selections = [
    { targetId: FRIDGE_ID, overrides: {} },
    { targetId: FREEZER_ID, overrides: {} },
  ];

  it("starts an enabled override from the form's limits for that target only", () => {
    const next = setOwnLimits(selections, FRIDGE_ID, fields, true, ",");
    expect(next[0]?.overrides).toEqual({
      temperature: { enabled: true, min: "0", max: "4" },
    });
    expect(next[1]).toBe(selections[1]);
  });

  it("keeps typed values when switched off and on again", () => {
    const typed = patchOwnLimit(
      setOwnLimits(selections, FRIDGE_ID, fields, true, ","),
      FRIDGE_ID,
      "temperature",
      { max: "3,5" },
    );
    const off = setOwnLimits(typed, FRIDGE_ID, fields, false, ",");
    expect(off[0]?.overrides.temperature).toEqual({ enabled: false, min: "0", max: "3,5" });
    const on = setOwnLimits(off, FRIDGE_ID, fields, true, ",");
    expect(on[0]?.overrides.temperature?.max).toBe("3,5");
  });

  it("ignores a patch for a field with no override yet", () => {
    expect(patchOwnLimit(selections, FRIDGE_ID, "temperature", { min: "1" })).toEqual(
      selections,
    );
  });
});

describe("applyTargetSelection", () => {
  const fridge = {
    targetId: FRIDGE_ID,
    overrides: { temperature: { enabled: true, min: "0", max: "2" } },
  };

  it("keeps the override drafts of targets that stay selected", () => {
    expect(applyTargetSelection([fridge], [FRIDGE_ID, FREEZER_ID])).toEqual([
      fridge,
      { targetId: FREEZER_ID, overrides: {} },
    ]);
  });

  it("drops deselected targets and follows the new order", () => {
    const freezer = { targetId: FREEZER_ID, overrides: {} };
    expect(applyTargetSelection([fridge, freezer], [FREEZER_ID])).toEqual([
      freezer,
    ]);
  });
});

describe("countTargetsWithCustomLimits", () => {
  it("counts targets with an enabled override on one of the form's fields", () => {
    const selections = [
      {
        targetId: FRIDGE_ID,
        overrides: { temperature: { enabled: true, min: "0", max: "2" } },
      },
      {
        targetId: FREEZER_ID,
        overrides: { temperature: { enabled: false, min: "0", max: "4" } },
      },
    ];

    expect(countTargetsWithCustomLimits(selections, ["temperature"])).toBe(1);
  });

  it("ignores overrides for fields the form no longer measures", () => {
    const selections = [
      {
        targetId: FRIDGE_ID,
        overrides: { old_field: { enabled: true, min: "0", max: "2" } },
      },
    ];

    expect(countTargetsWithCustomLimits(selections, ["temperature"])).toBe(0);
  });
});
