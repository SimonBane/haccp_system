import { formDefinitionSchema, getStarterForms } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  createBuilderField,
  emptyBuilderState,
  hasBuilderIssues,
  mintElementId,
  moveField,
  sameDefinition,
  toBuilderState,
  toDefinition,
  validateBuilder,
  type BuilderState,
} from "./form-builder";

const OPTION_LABELS: [string, string] = ["Yes", "No"];

function measurementField() {
  const field = createBuilderField("measurement", new Set(), {
    optionLabels: OPTION_LABELS,
  });
  if (field.type !== "measurement") throw new Error("expected a measurement");
  return field;
}

describe("mintElementId", () => {
  it("mints ids the shared schema accepts and avoids taken ones", () => {
    const id = mintElementId("f", new Set());

    expect(id).toMatch(/^f_[0-9a-f]{8}$/);
    expect(mintElementId("o", new Set([id]))).not.toBe(id);
  });
});

describe("toBuilderState and toDefinition", () => {
  it("round-trips every starter form without a change", () => {
    for (const starter of getStarterForms("bg")) {
      const state = toBuilderState(starter, ",");

      expect(hasBuilderIssues(validateBuilder(state))).toBe(false);
      expect(sameDefinition(toDefinition(state), starter.definition)).toBe(
        true,
      );
    }
  });

  it("parses limits typed with a decimal comma and leaves blanks open-ended", () => {
    const field = measurementField();
    const state: BuilderState = {
      ...emptyBuilderState(),
      name: "Hot holding",
      category: "cooking",
      fields: [
        {
          ...field,
          label: " Core temperature ",
          limits: { min: "62,5", max: "" },
        },
      ],
    };

    const definition = toDefinition(state);

    expect(definition.fields[0]).toMatchObject({
      label: "Core temperature",
      limits: { min: 62.5, max: null },
    });
    expect(formDefinitionSchema.safeParse(definition).success).toBe(true);
  });

  it("drops a blank help text instead of saving an empty string", () => {
    const field = createBuilderField("checkbox", new Set(), {
      optionLabels: OPTION_LABELS,
    });

    const definition = toDefinition({
      ...emptyBuilderState(),
      fields: [{ ...field, label: "Door closed", help: "   " }],
    });

    expect(definition.fields[0]).not.toHaveProperty("help");
  });
});

describe("validateBuilder", () => {
  it("points at the form settings and each field that needs fixing", () => {
    const measurement = measurementField();
    const choice = createBuilderField("choice", new Set(), {
      optionLabels: ["", "No"],
    });
    const state: BuilderState = {
      ...emptyBuilderState(),
      fields: [
        { ...measurement, label: "Temp", limits: { min: "8", max: "4" } },
        choice,
      ],
    };

    expect(validateBuilder(state)).toEqual({
      name: true,
      category: true,
      byField: {
        [measurement.id]: { limits: "order" },
        [choice.id]: { label: true, optionLabels: [0] },
      },
    });
  });

  it("rejects a limit beyond the unit's range or precision", () => {
    const field = measurementField();
    const state: BuilderState = {
      ...emptyBuilderState(),
      name: "pH",
      category: "other",
      fields: [
        { ...field, label: "pH", unit: "ph", limits: { min: "", max: "15" } },
      ],
    };

    expect(validateBuilder(state).byField[field.id]).toEqual({ limits: "max" });
  });

  it("requires at least one field", () => {
    expect(
      validateBuilder({ ...emptyBuilderState(), name: "x", category: "other" })
        .fields,
    ).toBe("empty");
  });
});

describe("moveField", () => {
  it("swaps neighbours and ignores moves past either end", () => {
    const fields = ["a", "b", "c"].map((id) => ({
      id,
      type: "checkbox" as const,
      label: id,
      required: false,
    }));

    expect(moveField(fields, 1, -1).map((field) => field.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(moveField(fields, 2, 1).map((field) => field.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("sameDefinition", () => {
  it("ignores key order but not field order", () => {
    const [goodsIn] = getStarterForms("en").filter(
      (form) => form.key === "goods_in",
    );
    const definition = goodsIn!.definition;
    const reordered = {
      fields: [...definition.fields].reverse(),
      correctiveAction: definition.correctiveAction,
    };
    const rekeyed = {
      fields: definition.fields,
      correctiveAction: definition.correctiveAction,
    };

    expect(sameDefinition(definition, rekeyed)).toBe(true);
    expect(sameDefinition(definition, reordered)).toBe(false);
  });
});
