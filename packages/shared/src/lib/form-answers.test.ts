import { describe, expect, it } from "vitest";
import type { FormDefinition, FormField } from "../schemas/form.js";
import {
  asksForCorrectiveAction,
  buildAnswerSchema,
  changedParameterFieldIds,
  correctiveSettings,
  evaluateAnswers,
  requiresCorrectiveAction,
  resolveCorrective,
  resolveLimits,
} from "./form-answers.js";

const temperature: FormField = {
  id: "temperature",
  type: "measurement",
  label: "Temperature",
  required: true,
  parameter: "temperature",
  unit: "celsius",
  limits: { min: 0, max: 5 },
} as FormField;

const packaging: FormField = {
  id: "packaging",
  type: "choice",
  label: "Packaging intact",
  required: true,
  multiple: false,
  options: [
    { id: "yes", label: "Yes", fails: false },
    { id: "no", label: "No", fails: true },
  ],
};

const allergens: FormField = {
  id: "allergens",
  type: "choice",
  label: "Allergens present",
  required: false,
  multiple: true,
  options: [
    { id: "nuts", label: "Nuts", fails: false },
    { id: "gluten", label: "Gluten", fails: false },
    { id: "unlabelled", label: "Unlabelled", fails: true },
  ],
};

const cleaned: FormField = {
  id: "cleaned",
  type: "checkbox",
  label: "Cleaned",
  required: true,
};

const note: FormField = {
  id: "note",
  type: "text",
  label: "Note",
  required: false,
  multiline: true,
};

const useBy: FormField = {
  id: "use_by",
  type: "date",
  label: "Use by",
  required: false,
};

function form(
  fields: FormField[],
  correctiveAction: FormDefinition["correctiveAction"] = "required_on_fail",
): FormDefinition {
  return { fields, correctiveAction };
}

describe("resolveLimits", () => {
  const humidity = {
    ...temperature,
    id: "humidity",
    parameter: "humidity",
    unit: "percent",
    limits: { min: 75, max: null },
  } as FormField;
  const definition = form([temperature, humidity, note]);

  it("takes each measurement field's default limits", () => {
    expect(resolveLimits(definition, null)).toEqual({
      temperature: { min: 0, max: 5 },
      humidity: { min: 75, max: null },
    });
  });

  it("gives each field the item's range for its own parameter", () => {
    expect(
      resolveLimits(definition, {
        temperature: { min: 0, max: 4 },
        humidity: { min: 80, max: 90 },
      }),
    ).toEqual({
      temperature: { min: 0, max: 4 },
      humidity: { min: 80, max: 90 },
    });
  });

  it("keeps the default for a field whose parameter the item has no range for", () => {
    expect(
      resolveLimits(definition, { temperature: { min: 0, max: 2 } }),
    ).toEqual({
      temperature: { min: 0, max: 2 },
      humidity: { min: 75, max: null },
    });
  });
});

describe("changedParameterFieldIds", () => {
  const core = { ...temperature, id: "core" } as FormField;

  it("names a kept field that now measures something else", () => {
    const next = form([
      { ...temperature, parameter: "humidity", unit: "percent" } as FormField,
      core,
    ]);

    expect(changedParameterFieldIds(form([temperature, core]), next)).toEqual([
      "temperature",
    ]);
  });

  it("ignores added, removed and relabelled fields", () => {
    const previous = form([temperature, note]);
    const next = form([{ ...temperature, label: "Air" } as FormField, core]);

    expect(changedParameterFieldIds(previous, next)).toEqual([]);
  });
});

describe("buildAnswerSchema", () => {
  const schema = buildAnswerSchema(
    form([temperature, packaging, allergens, cleaned, note, useBy]),
  );
  const valid = { temperature: 3.2, packaging: "yes", cleaned: true };

  it("accepts the required answers and fills defaults for optional ones", () => {
    expect(schema.parse(valid)).toEqual({
      temperature: 3.2,
      packaging: "yes",
      allergens: [],
      cleaned: true,
      note: "",
      use_by: null,
    });
  });

  it("accepts an out-of-limits reading: failing is not invalid", () => {
    expect(schema.safeParse({ ...valid, temperature: 12 }).success).toBe(true);
  });

  it("rejects a missing required measurement", () => {
    expect(schema.safeParse({ ...valid, temperature: undefined }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...valid, temperature: null }).success).toBe(
      false,
    );
  });

  it("rejects a reading beyond the unit's precision", () => {
    expect(schema.safeParse({ ...valid, temperature: 3.25 }).success).toBe(
      false,
    );
  });

  it("requires a required checkbox to be ticked", () => {
    expect(schema.safeParse({ ...valid, cleaned: false }).success).toBe(false);
  });

  it("allows exactly one option for a single choice", () => {
    expect(schema.safeParse({ ...valid, packaging: "maybe" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...valid, packaging: ["yes"] }).success).toBe(
      false,
    );
  });

  it("accepts several distinct options for a multiple choice", () => {
    expect(
      schema.safeParse({ ...valid, allergens: ["nuts", "gluten"] }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...valid, allergens: ["nuts", "nuts"] }).success,
    ).toBe(false);
  });

  it("rejects an impossible date", () => {
    expect(schema.safeParse({ ...valid, use_by: "2026-02-30" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...valid, use_by: "2026-02-28" }).success).toBe(
      true,
    );
  });

  it("rejects answers for fields the form does not have", () => {
    expect(schema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it("requires a required text answer to be non-blank", () => {
    const required = buildAnswerSchema(
      form([{ ...note, required: true } as FormField]),
    );
    expect(required.safeParse({ note: "   " }).success).toBe(false);
  });
});

describe("evaluateAnswers", () => {
  it("passes when a field could fail and none did", () => {
    const definition = form([temperature]);
    const evaluated = evaluateAnswers(
      definition,
      resolveLimits(definition, null),
      { temperature: 3.2 },
    );

    expect(evaluated.result).toBe("pass");
    expect(evaluated.values.temperature).toEqual({
      type: "measurement",
      value: 3.2,
      unit: "celsius",
      min: 0,
      max: 5,
      fails: false,
    });
  });

  it("fails a reading above max and below min, using the resolved limits", () => {
    const definition = form([temperature]);
    const limits = resolveLimits(definition, {
      temperature: { min: 0, max: 2 },
    });

    expect(evaluateAnswers(definition, limits, { temperature: 3 }).result).toBe(
      "fail",
    );
    expect(
      evaluateAnswers(definition, limits, { temperature: -0.1 }).result,
    ).toBe("fail");
    expect(evaluateAnswers(definition, limits, { temperature: 2 }).result).toBe(
      "pass",
    );
  });

  it("handles a minimum-only limit", () => {
    const core = {
      ...temperature,
      limits: { min: 75, max: null },
    } as FormField;
    const definition = form([core]);
    const limits = resolveLimits(definition, null);

    expect(
      evaluateAnswers(definition, limits, { temperature: 74.9 }).result,
    ).toBe("fail");
    expect(
      evaluateAnswers(definition, limits, { temperature: 99 }).result,
    ).toBe("pass");
  });

  it("fails when a selected option is marked as failing", () => {
    const definition = form([packaging, allergens]);
    const limits = resolveLimits(definition, null);

    const failed = evaluateAnswers(definition, limits, {
      packaging: "no",
      allergens: [],
    });
    expect(failed.result).toBe("fail");
    expect(failed.failedFieldIds).toEqual(["packaging"]);

    const multi = evaluateAnswers(definition, limits, {
      packaging: "yes",
      allergens: ["nuts", "unlabelled"],
    });
    expect(multi.failedFieldIds).toEqual(["allergens"]);
    expect(multi.values.allergens).toEqual({
      type: "choice",
      value: ["nuts", "unlabelled"],
      fails: true,
    });
  });

  it("is not evaluated when no field can fail", () => {
    const definition = form([cleaned, note, useBy]);
    const evaluated = evaluateAnswers(
      definition,
      {},
      {
        cleaned: true,
        note: "Done",
        use_by: null,
      },
    );

    expect(evaluated.result).toBe("not_evaluated");
    expect(evaluated.values).toEqual({
      cleaned: { type: "checkbox", value: true },
      note: { type: "text", value: "Done" },
      use_by: { type: "date", value: null },
    });
  });

  it("is not evaluated for a mark-as-done form", () => {
    expect(evaluateAnswers(form([]), {}, {}).result).toBe("not_evaluated");
  });

  it("treats a measurement without limits as unable to fail", () => {
    const definition = form([
      { ...temperature, limits: { min: null, max: null } } as FormField,
    ]);
    expect(
      evaluateAnswers(definition, resolveLimits(definition, null), {
        temperature: 50,
      }).result,
    ).toBe("not_evaluated");
  });

  it("does not fail an empty optional reading", () => {
    const optional = { ...temperature, required: false } as FormField;
    const definition = form([optional]);
    const evaluated = evaluateAnswers(
      definition,
      resolveLimits(definition, null),
      {
        temperature: null,
      },
    );

    expect(evaluated.result).toBe("pass");
    expect(evaluated.values.temperature).toMatchObject({
      value: null,
      fails: false,
    });
  });
});

describe("requiresCorrectiveAction", () => {
  it("is required only for a failed result on a required_on_fail form", () => {
    expect(requiresCorrectiveAction(form([]), "fail")).toBe(true);
    expect(requiresCorrectiveAction(form([]), "pass")).toBe(false);
    expect(requiresCorrectiveAction(form([], "optional"), "fail")).toBe(false);
    expect(requiresCorrectiveAction(form([], "off"), "fail")).toBe(false);
  });
});

describe("asksForCorrectiveAction", () => {
  it("asks on every form except one with corrective action turned off", () => {
    expect(asksForCorrectiveAction(form([]))).toBe(true);
    expect(asksForCorrectiveAction(form([], "optional"))).toBe(true);
    expect(asksForCorrectiveAction(form([], "off"))).toBe(false);
  });
});

describe("resolveCorrective", () => {
  const definition: FormDefinition = {
    fields: [],
    correctiveAction: "required_on_fail",
    corrective: {
      answers: [
        { id: "a_moved", label: "Moved product" },
        { id: "a_manager", label: "Notified manager" },
      ],
      multiple: true,
      allowNote: true,
    },
  };
  const withSettings = (
    corrective: Partial<NonNullable<FormDefinition["corrective"]>>,
  ): FormDefinition => ({
    ...definition,
    corrective: { ...definition.corrective!, ...corrective },
  });

  it("lists the chosen answers in the form's order, then the trimmed note", () => {
    expect(
      resolveCorrective(definition, {
        answerIds: ["a_manager", "a_moved"],
        note: "  Door was open ",
      }),
    ).toEqual({
      answers: definition.corrective!.answers,
      note: "Door was open",
      text: "Moved product, Notified manager, Door was open",
      issue: null,
    });
  });

  it("asks for something when the form requires it, and not when it is optional", () => {
    const nothing = { answerIds: [], note: "  " };

    expect(resolveCorrective(definition, nothing)).toMatchObject({
      text: null,
      issue: "required",
    });
    expect(
      resolveCorrective({ ...definition, correctiveAction: "optional" }, nothing)
        .issue,
    ).toBeNull();
  });

  it("takes nothing on a form with corrective action turned off", () => {
    const off: FormDefinition = { ...definition, correctiveAction: "off" };

    expect(resolveCorrective(off, { answerIds: [], note: " " })).toMatchObject({
      text: null,
      issue: null,
    });
    expect(
      resolveCorrective(off, { answerIds: ["a_moved"], note: "" }).issue,
    ).toBe("not_asked");
    expect(resolveCorrective(off, { answerIds: [], note: "Moved" }).issue).toBe(
      "not_asked",
    );
  });

  it("refuses an answer the form does not have", () => {
    expect(
      resolveCorrective(definition, { answerIds: ["a_other"], note: "" }).issue,
    ).toBe("unknown_answer");
  });

  it("refuses several answers when the form takes one", () => {
    expect(
      resolveCorrective(withSettings({ multiple: false }), {
        answerIds: ["a_moved", "a_manager"],
        note: "",
      }).issue,
    ).toBe("single_answer_only");
  });

  it("refuses a note when the form takes none", () => {
    expect(
      resolveCorrective(withSettings({ allowNote: false }), {
        answerIds: ["a_moved"],
        note: "Door was open",
      }).issue,
    ).toBe("note_not_allowed");
  });

  it("treats a definition without settings as note-only", () => {
    const legacy: FormDefinition = {
      fields: [],
      correctiveAction: "required_on_fail",
    };

    expect(
      resolveCorrective(legacy, { answerIds: [], note: "Moved stock" }),
    ).toMatchObject({ text: "Moved stock", issue: null });
    expect(correctiveSettings(legacy)).toEqual({
      answers: [],
      multiple: true,
      allowNote: true,
    });
  });
});
