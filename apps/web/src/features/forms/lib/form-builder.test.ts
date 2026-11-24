import { formDefinitionSchema, getStarterForms } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  addCorrectiveAnswer,
  chooseCategory,
  correctiveNoteShown,
  createBuilderField,
  duplicateField,
  failRules,
  insertField,
  insertFieldAt,
  emptyBuilderState,
  hasBuilderIssues,
  mintElementId,
  moveField,
  moveFieldTo,
  sameBuilderState,
  sameDefinition,
  seedCorrectiveAnswers,
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

  it("starts a new measurement as a temperature in °C", () => {
    expect(measurementField()).toMatchObject({
      parameter: "temperature",
      unit: "celsius",
    });
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
      validateBuilder({
        ...emptyBuilderState(),
        name: "x",
        category: "hygiene",
      }).fields,
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

describe("moveFieldTo", () => {
  const fields = ["a", "b", "c", "d"].map((id) => ({
    id,
    type: "checkbox" as const,
    label: id,
    required: false,
  }));
  const ids = (list: readonly { id: string }[]) =>
    list.map((field) => field.id);

  it("lands a dragged field at the drop position, up or down the list", () => {
    expect(ids(moveFieldTo(fields, "a", 2))).toEqual(["b", "c", "a", "d"]);
    expect(ids(moveFieldTo(fields, "d", 0))).toEqual(["d", "a", "b", "c"]);
  });

  it("clamps past either end and ignores a field that is gone", () => {
    expect(ids(moveFieldTo(fields, "b", 99))).toEqual(["a", "c", "d", "b"]);
    expect(ids(moveFieldTo(fields, "c", -1))).toEqual(["c", "a", "b", "d"]);
    expect(ids(moveFieldTo(fields, "f_gone", 0))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("sameDefinition", () => {
  it("ignores key order but not field order", () => {
    const [goodsIn] = getStarterForms("en").filter(
      (form) => form.key === "goods_in",
    );
    const definition = goodsIn!.definition;
    const reordered = {
      ...definition,
      fields: [...definition.fields].reverse(),
    };
    const rekeyed = {
      corrective: definition.corrective,
      fields: definition.fields,
      correctiveAction: definition.correctiveAction,
    };

    expect(sameDefinition(definition, rekeyed)).toBe(true);
    expect(sameDefinition(definition, reordered)).toBe(false);
  });
});

function checkboxField(label: string) {
  return {
    ...createBuilderField("checkbox", new Set(), {
      optionLabels: OPTION_LABELS,
    }),
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

describe("insertFieldAt", () => {
  const first = checkboxField("First");
  const second = checkboxField("Second");
  const added = checkboxField("Added");
  const labels = (list: readonly { label: string }[]) =>
    list.map((f) => f.label);

  it("places a dropped field type at the drop position", () => {
    expect(labels(insertFieldAt([first, second], 0, added))).toEqual([
      "Added",
      "First",
      "Second",
    ]);
    expect(labels(insertFieldAt([first, second], 1, added))).toEqual([
      "First",
      "Added",
      "Second",
    ]);
    expect(labels(insertFieldAt([first, second], 2, added))).toEqual([
      "First",
      "Second",
      "Added",
    ]);
  });

  it("clamps a position outside the list", () => {
    expect(labels(insertFieldAt([first], 5, added))).toEqual([
      "First",
      "Added",
    ]);
    expect(labels(insertFieldAt([first], -2, added))).toEqual([
      "Added",
      "First",
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
    const unlabelled = {
      ...measurementField(),
      limits: { min: "0", max: "5" },
    };
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

describe("corrective settings", () => {
  const withAnswers = (labels: string[], allowNote = true): BuilderState => ({
    ...emptyBuilderState(),
    corrective: {
      answers: labels.map((label, index) => ({ id: `a_${index}`, label })),
      multiple: false,
      allowNote,
    },
  });

  it("reads a definition without settings as note-only", () => {
    const state = toBuilderState(
      {
        name: "Old form",
        category: "cleaning",
        appliesTo: "location",
        definition: { fields: [], correctiveAction: "optional" },
      },
      ".",
    );

    expect(state.corrective).toEqual({
      answers: [],
      multiple: true,
      allowNote: true,
    });
  });

  it("publishes trimmed answers with their ids and settings", () => {
    expect(
      toDefinition(withAnswers([" Moved product "], false)).corrective,
    ).toEqual({
      answers: [{ id: "a_0", label: "Moved product" }],
      multiple: false,
      allowNote: false,
    });
  });

  it("keeps the note on when there are no answers to pick", () => {
    const state = withAnswers([], false);

    expect(correctiveNoteShown(state.corrective)).toBe(true);
    expect(toDefinition(state).corrective?.allowNote).toBe(true);
  });

  it("flags answers with a blank label", () => {
    const issues = validateBuilder(withAnswers(["Moved product", "  "]));

    expect(issues.correctiveLabels).toEqual([1]);
    expect(hasBuilderIssues(issues)).toBe(true);
  });

  it("ignores blank answers while corrective action is off, and does not publish them", () => {
    const state: BuilderState = {
      ...withAnswers(["Moved product", "  "]),
      correctiveAction: "off",
    };

    expect(validateBuilder(state).correctiveLabels).toBeUndefined();
    expect(toDefinition(state)).toMatchObject({
      correctiveAction: "off",
      corrective: { answers: [{ id: "a_0", label: "Moved product" }] },
    });
    expect(formDefinitionSchema.safeParse(toDefinition(state)).success).toBe(
      true,
    );
  });

  it("opens an optional form as required, since the builder only turns it on or off", () => {
    const source = {
      name: "Old form",
      category: "cleaning" as const,
      appliesTo: "location" as const,
    };

    expect(
      toBuilderState(
        { ...source, definition: { fields: [], correctiveAction: "optional" } },
        ".",
      ).correctiveAction,
    ).toBe("required_on_fail");
    expect(
      toBuilderState(
        { ...source, definition: { fields: [], correctiveAction: "off" } },
        ".",
      ).correctiveAction,
    ).toBe("off");
  });

  it("adds answers with fresh ids, up to the limit", () => {
    let corrective = emptyBuilderState().corrective;
    for (let index = 0; index < 10; index += 1) {
      corrective = addCorrectiveAnswer(corrective, `Answer ${index}`);
    }

    expect(corrective.answers).toHaveLength(8);
    expect(new Set(corrective.answers.map((answer) => answer.id)).size).toBe(8);
  });

  it("seeds a new form's answers and leaves existing ones alone", () => {
    const seeded = seedCorrectiveAnswers(emptyBuilderState(), [
      "Moved product",
      "Notified manager",
    ]);

    expect(seeded.corrective.answers.map((answer) => answer.label)).toEqual([
      "Moved product",
      "Notified manager",
    ]);
    expect(seedCorrectiveAnswers(seeded, ["Called service"])).toBe(seeded);
  });

  it("seeds answers when a blank form gets its first category, not when it changes", () => {
    const first = chooseCategory(emptyBuilderState(), "temperature", [
      "Moved product",
    ]);
    expect(first.category).toBe("temperature");
    expect(first.corrective.answers.map((answer) => answer.label)).toEqual([
      "Moved product",
    ]);

    const cleared = {
      ...first,
      corrective: { ...first.corrective, answers: [] },
    };
    const switched = chooseCategory(cleared, "cleaning", ["Cleaned again"]);
    expect(switched.category).toBe("cleaning");
    expect(switched.corrective.answers).toEqual([]);
  });
});
