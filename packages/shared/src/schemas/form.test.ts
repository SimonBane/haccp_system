import { describe, expect, it } from "vitest";
import {
  CHOICE_OPTION_LABEL_MAX_LENGTH,
  FORM_FIELD_HELP_MAX_LENGTH,
  FORM_FIELD_LABEL_MAX_LENGTH,
  FORM_NAME_MAX_LENGTH,
  checkMeasurementLimits,
  createFormSchema,
  updateFormSchema,
  checkTemplateTargets,
  formCategorySchema,
  formDefinitionSchema,
  formListItemSchema,
  isValidMeasurementValue,
  type FormField,
} from "./form.js";

describe("formCategorySchema", () => {
  it.each(["temperature", "cleaning", "hygiene", "pest_control", "goods_in"])(
    "accepts %s",
    (category) => {
      expect(formCategorySchema.safeParse(category).success).toBe(true);
    },
  );

  it.each(["cooking", "cooling", "other"])("rejects retired %s", (category) => {
    expect(formCategorySchema.safeParse(category).success).toBe(false);
  });
});

describe("formListItemSchema", () => {
  const item = {
    id: "7b0d7f1e-3b9a-4a51-9a64-2f1b0f6d8a11",
    name: "Fridge",
    category: "temperature",
    appliesTo: "per_item",
    onDemand: false,
    latestVersion: {
      id: "0c6a1f2e-5d4b-4b3a-8f2e-1a9b8c7d6e5f",
      formId: "7b0d7f1e-3b9a-4a51-9a64-2f1b0f6d8a11",
      version: 1,
      definition: { fields: [], correctiveAction: "optional" },
      createdAt: "2026-10-01T09:00:00.000Z",
    },
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
  };

  it("requires a non-negative template count", () => {
    expect(formListItemSchema.safeParse({ ...item, templateCount: 3 }).success).toBe(true);
    expect(formListItemSchema.safeParse(item).success).toBe(false);
    expect(formListItemSchema.safeParse({ ...item, templateCount: -1 }).success).toBe(false);
  });
});

function definition(fields: FormField[]) {
  return { fields, correctiveAction: "required_on_fail" as const };
}

const fridge: FormField = {
  id: "temperature",
  type: "measurement",
  label: "Temperature",
  required: true,
  parameter: "temperature",
  unit: "celsius",
  limits: { min: 0, max: 5 },
};

const decision: FormField = {
  id: "decision",
  type: "choice",
  label: "Decision",
  required: true,
  multiple: false,
  options: [
    { id: "accepted", label: "Accepted", fails: false },
    { id: "rejected", label: "Rejected", fails: true },
  ],
};

describe("isValidMeasurementValue", () => {
  it("accepts values within the unit's range and precision", () => {
    expect(isValidMeasurementValue(3.2, "celsius")).toBe(true);
    expect(isValidMeasurementValue(-99.9, "celsius")).toBe(true);
    expect(isValidMeasurementValue(4.55, "ph")).toBe(true);
    expect(isValidMeasurementValue(0.875, "water_activity")).toBe(true);
  });

  it("rejects values outside the range", () => {
    expect(isValidMeasurementValue(100, "celsius")).toBe(false);
    expect(isValidMeasurementValue(14.01, "ph")).toBe(false);
    expect(isValidMeasurementValue(-1, "percent")).toBe(false);
  });

  it("rejects more decimals than the unit allows", () => {
    expect(isValidMeasurementValue(3.25, "celsius")).toBe(false);
    expect(isValidMeasurementValue(12.5, "minutes")).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(isValidMeasurementValue(Number.NaN, "celsius")).toBe(false);
    expect(isValidMeasurementValue(Infinity, "ppm")).toBe(false);
  });
});

describe("checkMeasurementLimits", () => {
  it("accepts a minimum only, a maximum only, both, or none", () => {
    expect(checkMeasurementLimits({ min: 75, max: null }, "celsius")).toEqual(
      [],
    );
    expect(checkMeasurementLimits({ min: null, max: 4.6 }, "ph")).toEqual([]);
    expect(checkMeasurementLimits({ min: 0, max: 5 }, "celsius")).toEqual([]);
    expect(checkMeasurementLimits({ min: null, max: null }, "celsius")).toEqual(
      [],
    );
  });

  it("requires min below max", () => {
    expect(checkMeasurementLimits({ min: 5, max: 5 }, "celsius")).toEqual([
      "order",
    ]);
  });

  it("flags limits outside the unit", () => {
    expect(checkMeasurementLimits({ min: -1, max: 15 }, "ph")).toEqual([
      "min_out_of_range",
      "max_out_of_range",
    ]);
  });
});

describe("formDefinitionSchema", () => {
  it("accepts every field type together", () => {
    const result = formDefinitionSchema.safeParse(
      definition([
        fridge,
        decision,
        { id: "cleaned", type: "checkbox", label: "Cleaned", required: true },
        {
          id: "note",
          type: "text",
          label: "Note",
          required: false,
          multiline: true,
        },
        { id: "use_by", type: "date", label: "Use by", required: false },
      ]),
    );

    expect(result.success).toBe(true);
  });

  it("accepts a form with no fields as mark-as-done", () => {
    expect(formDefinitionSchema.safeParse(definition([])).success).toBe(true);
  });

  it("rejects duplicate field ids", () => {
    const result = formDefinitionSchema.safeParse(
      definition([fridge, { ...decision, id: "temperature" }]),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["fields", 1, "id"]);
  });

  it("rejects duplicate option ids within a choice", () => {
    const result = formDefinitionSchema.safeParse(
      definition([
        {
          ...decision,
          options: [
            { id: "a", label: "A", fails: false },
            { id: "a", label: "B", fails: true },
          ],
        } as FormField,
      ]),
    );

    expect(result.success).toBe(false);
  });

  it("requires at least two options for a choice", () => {
    const result = formDefinitionSchema.safeParse(
      definition([
        {
          ...decision,
          options: [{ id: "a", label: "A", fails: false }],
        } as FormField,
      ]),
    );

    expect(result.success).toBe(false);
  });

  it("rejects default limits with min above max", () => {
    const result = formDefinitionSchema.safeParse(
      definition([{ ...fridge, limits: { min: 8, max: 2 } } as FormField]),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([
      "fields",
      0,
      "limits",
      "min",
    ]);
  });

  it("rejects an unknown unit", () => {
    const result = formDefinitionSchema.safeParse(
      definition([{ ...fridge, unit: "fahrenheit" } as unknown as FormField]),
    );

    expect(result.success).toBe(false);
  });

  it("rejects an unknown parameter", () => {
    const result = formDefinitionSchema.safeParse(
      definition([
        { ...fridge, parameter: "fridge_temperature" } as unknown as FormField,
      ]),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a unit other than the parameter's own", () => {
    const result = formDefinitionSchema.safeParse(
      definition([{ ...fridge, parameter: "humidity" } as FormField]),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["fields", 0, "unit"]);
  });

  it("accepts two fields measuring the same thing", () => {
    const result = formDefinitionSchema.safeParse(
      definition([fridge, { ...fridge, id: "core" } as FormField]),
    );

    expect(result.success).toBe(true);
  });

  it("rejects ids with spaces", () => {
    const result = formDefinitionSchema.safeParse(
      definition([{ ...fridge, id: "core temp" }]),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a blank label", () => {
    const result = formDefinitionSchema.safeParse(
      definition([{ ...fridge, label: "   " }]),
    );

    expect(result.success).toBe(false);
  });
});

describe("formDefinitionSchema corrective settings", () => {
  const withCorrective = (corrective: unknown) =>
    formDefinitionSchema.safeParse({
      fields: [],
      correctiveAction: "required_on_fail",
      corrective,
    });

  it("accepts a definition published before forms had their own answers", () => {
    expect(
      formDefinitionSchema.safeParse({ fields: [], correctiveAction: "optional" })
        .success,
    ).toBe(true);
  });

  it("accepts corrective action turned off", () => {
    expect(
      formDefinitionSchema.safeParse({ fields: [], correctiveAction: "off" }).success,
    ).toBe(true);
  });

  it("accepts answers and trims their labels", () => {
    const parsed = withCorrective({
      answers: [{ id: "a_moved", label: "  Moved product " }],
      multiple: false,
      allowNote: false,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.corrective?.answers[0]?.label).toBe("Moved product");
  });

  it("rejects duplicate answer ids", () => {
    expect(
      withCorrective({
        answers: [
          { id: "a_same", label: "Moved product" },
          { id: "a_same", label: "Notified manager" },
        ],
        multiple: true,
        allowNote: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a form that takes neither answers nor a note", () => {
    expect(
      withCorrective({ answers: [], multiple: true, allowNote: false }).success,
    ).toBe(false);
  });

  it("rejects a blank label, an overlong one and more than eight answers", () => {
    const settings = (answers: unknown[]) =>
      withCorrective({ answers, multiple: true, allowNote: true }).success;

    expect(settings([{ id: "a_1", label: "  " }])).toBe(false);
    expect(settings([{ id: "a_1", label: "x".repeat(81) }])).toBe(false);
    expect(
      settings(
        Array.from({ length: 9 }, (_, index) => ({
          id: `a_${index}`,
          label: `Answer ${index}`,
        })),
      ),
    ).toBe(false);
  });
});

describe("checkTemplateTargets", () => {
  it("needs at least one item for a per-item form", () => {
    expect(checkTemplateTargets("per_item", 3)).toBeNull();
    expect(checkTemplateTargets("per_item", 0)).toBe("targets_required");
  });

  it("refuses items on a whole-location form", () => {
    expect(checkTemplateTargets("location", 0)).toBeNull();
    expect(checkTemplateTargets("location", 1)).toBe("targets_not_allowed");
  });
});

describe("form text limits", () => {
  const over = (max: number) => "a".repeat(max + 1);
  const at = (max: number) => "a".repeat(max);
  const choice = (label: string, optionLabel: string, help?: string): FormField => ({
    id: "pick",
    type: "choice",
    label,
    ...(help === undefined ? {} : { help }),
    required: true,
    multiple: false,
    options: [
      { id: "a", label: optionLabel, fails: false },
      { id: "b", label: "No", fails: true },
    ],
  });
  const parse = (name: string, field: FormField) =>
    createFormSchema.safeParse({
      name,
      category: "cleaning",
      appliesTo: "location",
      definition: definition([field]),
    }).success;

  it("accepts every text at its limit", () => {
    expect(
      parse(
        at(FORM_NAME_MAX_LENGTH),
        choice(
          at(FORM_FIELD_LABEL_MAX_LENGTH),
          at(CHOICE_OPTION_LABEL_MAX_LENGTH),
          at(FORM_FIELD_HELP_MAX_LENGTH),
        ),
      ),
    ).toBe(true);
  });

  it("rejects any text one character over its limit", () => {
    expect(parse(over(FORM_NAME_MAX_LENGTH), choice("Clean?", "Yes"))).toBe(false);
    expect(parse("Form", choice(over(FORM_FIELD_LABEL_MAX_LENGTH), "Yes"))).toBe(false);
    expect(parse("Form", choice("Clean?", over(CHOICE_OPTION_LABEL_MAX_LENGTH)))).toBe(false);
    expect(parse("Form", choice("Clean?", "Yes", over(FORM_FIELD_HELP_MAX_LENGTH)))).toBe(false);
  });
});

describe("on-demand flag", () => {
  const base = {
    name: "Spill clean-up",
    category: "cleaning",
    appliesTo: "location",
    definition: {
      fields: [{ id: "cleaned", type: "checkbox", label: "Cleaned", required: true }],
      correctiveAction: "optional",
    },
  };

  it("is off unless the form asks for it", () => {
    expect(createFormSchema.parse(base).onDemand).toBe(false);
    expect(createFormSchema.parse({ ...base, onDemand: true }).onDemand).toBe(true);
  });

  it("is left unchanged by an update that does not mention it", () => {
    const settings = {
      name: base.name,
      category: base.category,
      appliesTo: base.appliesTo,
    };
    expect(updateFormSchema.parse(settings).onDemand).toBeUndefined();
  });
});
