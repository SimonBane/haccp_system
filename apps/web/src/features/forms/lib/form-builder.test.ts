import { formDefinitionSchema, getStarterForms } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  createBuilderField,
  duplicateField,
  failRules,
  insertField,
  emptyBuilderState,
  hasBuilderIssues,
  mintElementId,
  moveField,
  sameBuilderState,
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
      category: "temperature",
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
      appliesTo: true,
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
      category: "hygiene",
      fields: [
        { ...field, label: "pH", unit: "ph", limits: { min: "", max: "15" } },
      ],
    };

    expect(validateBuilder(state).byField[field.id]).toEqual({ limits: "max" });
  });

  it("requires what the form is filled in for", () => {
    expect(
      validateBuilder({
        ...emptyBuilderState(),
        name: "x",
        category: "hygiene",
        appliesTo: "",
      }).appliesTo,
    ).toBe(true);
    expect(
      validateBuilder({
        ...emptyBuilderState(),
        name: "x",
        category: "hygiene",
        appliesTo: "location",
      }).appliesTo,
    ).toBeUndefined();
  });

  it("requires at least one field", () => {
    expect(
      validateBuilder({ ...emptyBuilderState(), name: "x", category: "hygiene" })
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

function checkboxField(label: string) {
  return {
    ...createBuilderField("checkbox", new Set(), { optionLabels: OPTION_LABELS }),
    label,
  };
}

function choiceField() {
  const field = createBuilderField("choice", new Set(), {
    optionLabels: OPTION_LABELS,
  });
  if (field.type !== "choice") throw new Error("expected a choice");
  return field;
}

describe("insertField", () => {
  const first = checkboxField("First");
  const second = checkboxField("Second");
  const added = checkboxField("Added");

  it("places the new field right after the selected one", () => {
    expect(
      insertField([first, second], first.id, added).map((f) => f.label),
    ).toEqual(["First", "Added", "Second"]);
  });

  it("appends when nothing is selected or the selection is gone", () => {
    expect(insertField([first], null, added).map((f) => f.label)).toEqual([
      "First",
      "Added",
    ]);
    expect(insertField([first], "f_gone", added).map((f) => f.label)).toEqual([
      "First",
      "Added",
    ]);
  });
});

describe("duplicateField", () => {
  it("mints a new field id and new option ids, keeping everything else", () => {
    const original = { ...choiceField(), label: "Packaging intact" };

    const copy = duplicateField(
      original,
      new Set([original.id]),
      "Packaging intact (copy)",
    );

    if (copy.type !== "choice") throw new Error("expected a choice");
    expect(copy.id).not.toBe(original.id);
    expect(copy.label).toBe("Packaging intact (copy)");
    expect(copy.options.map((o) => o.label)).toEqual(["Yes", "No"]);
    expect(copy.options.map((o) => o.fails)).toEqual([false, true]);
    expect(
      copy.options.some((o) => original.options.some((p) => p.id === o.id)),
    ).toBe(false);
    expect(new Set(copy.options.map((o) => o.id)).size).toBe(2);
  });
});

describe("failRules", () => {
  it("lists measurement limits and failing options, in field order", () => {
    const temperature = {
      ...measurementField(),
      label: "Air temperature",
      limits: { min: "0", max: "4,5" },
    };
    const storage = { ...choiceField(), label: "Packaging intact" };

    expect(failRules([temperature, storage])).toEqual([
      {
        kind: "limits",
        fieldId: temperature.id,
        label: "Air temperature",
        unit: "celsius",
        limits: { min: 0, max: 4.5 },
      },
      {
        kind: "options",
        fieldId: storage.id,
        label: "Packaging intact",
        options: ["No"],
      },
    ]);
  });

  it("leaves out unlabelled fields, open measurements and invalid limits", () => {
    const open = { ...measurementField(), label: "Probe" };
    const unlabelled = { ...measurementField(), limits: { min: "0", max: "5" } };
    const inverted = {
      ...measurementField(),
      label: "Inverted",
      limits: { min: "5", max: "0" },
    };
    const neverFails = {
      ...choiceField(),
      label: "Chemical",
      options: choiceField().options.map((o) => ({ ...o, fails: false })),
    };

    expect(failRules([open, unlabelled, inverted, neverFails])).toEqual([]);
  });
});

describe("sameBuilderState", () => {
  it("ignores key order but not values", () => {
    const state: BuilderState = {
      ...emptyBuilderState(),
      name: "Fridge",
      category: "temperature",
    };
    const reordered = Object.fromEntries(
      Object.entries(state).reverse(),
    ) as BuilderState;

    expect(sameBuilderState(state, reordered)).toBe(true);
    expect(sameBuilderState(state, { ...state, name: "Freezer" })).toBe(false);
  });
});
