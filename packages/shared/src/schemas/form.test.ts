import { describe, expect, it } from "vitest";
import {
  checkMeasurementLimits,
  createFormVersionSchema,
  formDefinitionSchema,
  isValidMeasurementValue,
  type FormField,
} from "./form.js";

function definition(fields: FormField[]) {
  return { fields, correctiveAction: "required_on_fail" as const };
}

const fridge: FormField = {
  id: "temperature",
  type: "measurement",
  label: "Temperature",
  required: true,
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

describe("createFormVersionSchema", () => {
  it("does not confirm dropped overrides unless asked", () => {
    const parsed = createFormVersionSchema.parse({
      definition: definition([fridge]),
    });

    expect(parsed.confirmDroppedOverrides).toBe(false);
  });
});
