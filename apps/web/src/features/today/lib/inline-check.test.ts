import {
  evaluateAnswers,
  type AnswersInput,
  type CheckboxField,
  type ChoiceField,
  type FormDefinition,
  type FormField,
  type MeasurementField,
  type TodayTaskItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  inlineField,
  inlineOptions,
  inlineRows,
  passingDraft,
  sameAnswer,
  TICK_OPTION_ID,
  toggleOption,
  withValue,
  type InlineDrafts,
} from "./inline-check";
import type { TodayCheck } from "./today-day";

const tick: CheckboxField = {
  id: "cleaned",
  label: "Cleaned",
  required: true,
  type: "checkbox",
};

const result: ChoiceField = {
  id: "result",
  label: "Result",
  required: true,
  type: "choice",
  multiple: false,
  options: [
    { id: "clean", label: "Clean", fails: false },
    { id: "dirty", label: "Not clean", fails: true },
  ],
};

const temperature: MeasurementField = {
  id: "temp",
  label: "Temperature",
  required: true,
  type: "measurement",
  unit: "celsius",
  limits: { min: 0, max: 4 },
};

function definition(fields: FormField[]): FormDefinition {
  return { fields, correctiveAction: "required_on_fail" };
}

function check(
  key: string,
  form: FormDefinition,
  answers: AnswersInput | null = null,
): TodayCheck {
  const resolvedLimits = Object.fromEntries(
    form.fields.flatMap((field) =>
      field.type === "measurement" ? [[field.id, field.limits]] : [],
    ),
  );
  const values = answers
    ? evaluateAnswers(form, resolvedLimits, answers).values
    : null;
  return {
    key,
    task: { resolvedLimits, values } as unknown as TodayTaskItem,
    status: answers ? "completed" : "pending",
    isDone: answers !== null,
    isDeviation: false,
  };
}

const reading = (sign: 1 | -1, digits: string) =>
  ({ type: "measurement", sign, digits }) as const;

describe("inlineField", () => {
  it("answers any form with one control on the rows", () => {
    expect(inlineField(definition([tick]))).toBe(tick);
    expect(inlineField(definition([temperature]))).toBe(temperature);
    expect(
      inlineField(definition([{ ...tick, required: false }])),
    ).not.toBeNull();
  });

  it("opens forms with more than one control", () => {
    expect(inlineField(definition([temperature, tick]))).toBeNull();
  });
});

describe("inlineOptions", () => {
  const many: ChoiceField = {
    ...result,
    options: ["a", "b", "c", "d"].map((id) => ({
      id,
      label: id,
      fails: false,
    })),
  };

  it("gives a tick one button named after the field", () => {
    expect(inlineOptions(tick)).toEqual([
      { id: TICK_OPTION_ID, label: "Cleaned", fails: false },
    ]);
  });

  it("uses buttons for short choices and a select past three options", () => {
    expect(inlineOptions(result)).toBe(result.options);
    expect(inlineOptions(many)).toBeNull();
    expect(inlineOptions({ ...many, multiple: true })).toBe(many.options);
  });

  it("leaves readings, text and dates to an input", () => {
    expect(inlineOptions(temperature)).toBeNull();
  });
});

describe("passingDraft", () => {
  it("fills ticks and the first passing option", () => {
    expect(passingDraft(tick)).toEqual({ type: "checkbox", value: true });
    expect(passingDraft(result)).toEqual({ type: "choice", value: ["clean"] });
  });

  it("has nothing to fill for readings or when every option fails", () => {
    expect(passingDraft(temperature)).toBeNull();
    expect(
      passingDraft({
        ...result,
        options: [{ id: "x", label: "X", fails: true }],
      }),
    ).toBeNull();
  });
});

describe("toggleOption", () => {
  it("takes a single choice back on a second tap", () => {
    const chosen = toggleOption(result, { type: "choice", value: [] }, "clean");
    expect(chosen).toEqual({ type: "choice", value: ["clean"] });
    expect(toggleOption(result, chosen, "clean")).toEqual({
      type: "choice",
      value: [],
    });
    expect(toggleOption(result, chosen, "dirty")).toEqual({
      type: "choice",
      value: ["dirty"],
    });
  });

  it("adds to a multiple choice", () => {
    const multiple = { ...result, multiple: true };
    expect(
      toggleOption(multiple, { type: "choice", value: ["clean"] }, "dirty"),
    ).toEqual({ type: "choice", value: ["clean", "dirty"] });
  });
});

describe("inlineRows", () => {
  const form = definition([temperature]);

  it("judges a typed reading against the item's limits", () => {
    const drafts: InlineDrafts = {
      a: { value: reading(1, "3,5"), answerIds: [], note: "" },
      b: { value: reading(1, "7"), answerIds: [], note: "" },
    };
    const [a, b] = inlineRows(
      form,
      temperature,
      [check("a", form), check("b", form)],
      drafts,
      ",",
    );

    expect(a).toMatchObject({ isReady: true, fails: false, issue: null });
    expect(b).toMatchObject({ isReady: true, fails: true });
  });

  it("holds back a reading still being typed", () => {
    const [row] = inlineRows(
      form,
      temperature,
      [check("a", form)],
      { a: { value: reading(1, "4,"), answerIds: [], note: "" } },
      ",",
    );

    expect(row).toMatchObject({ isReady: false, issue: "invalid" });
  });

  it("reads a minus typed into the text as a negative reading", () => {
    const [row] = inlineRows(
      form,
      temperature,
      [check("a", form)],
      { a: { value: reading(1, "-2"), answerIds: [], note: "" } },
      ",",
    );

    expect(row).toMatchObject({ isReady: true, fails: true });
  });

  it("shows what is saved and only counts a real change", () => {
    const saved = check("a", form, { temp: 3 });
    const [unchanged] = inlineRows(form, temperature, [saved], {}, ",");
    const [same] = inlineRows(
      form,
      temperature,
      [saved],
      { a: { value: reading(1, "3"), answerIds: [], note: "" } },
      ",",
    );

    expect(unchanged).toMatchObject({
      value: reading(1, "3"),
      hasDraft: false,
      isReady: false,
    });
    expect(same?.isReady).toBe(false);
  });
});

describe("sameAnswer", () => {
  const form = definition([temperature]);

  it("tells a minus or a trailing comma apart from an empty field", () => {
    expect(sameAnswer(form, temperature, reading(1, "-"), reading(1, ""))).toBe(
      false,
    );
    expect(
      sameAnswer(form, temperature, reading(1, "4,"), reading(1, "")),
    ).toBe(false);
    expect(
      sameAnswer(form, temperature, reading(1, "-3"), reading(-1, "3")),
    ).toBe(true);
  });
});

describe("withValue", () => {
  it("drops a draft that matches what is saved", () => {
    const drafts: InlineDrafts = { a: { value: reading(1, "4"), answerIds: [], note: "" } };
    expect(withValue(drafts, "a", reading(1, "3"), true)).toEqual({});
  });

  it("keeps an emptied reading so it can be retyped", () => {
    expect(withValue({}, "a", reading(1, ""), false)).toEqual({
      a: { value: reading(1, ""), answerIds: [], note: "" },
    });
  });

  it("lets an emptied tap fall back to what is saved", () => {
    expect(withValue({}, "a", { type: "choice", value: [] }, false)).toEqual(
      {},
    );
  });

  it("keeps the chosen actions while the value changes", () => {
    const drafts: InlineDrafts = {
      a: { value: reading(1, "7"), answerIds: ["a_moved"], note: "Door open" },
    };
    expect(withValue(drafts, "a", reading(1, "8"), false).a).toMatchObject({
      answerIds: ["a_moved"],
      note: "Door open",
    });
  });
});
