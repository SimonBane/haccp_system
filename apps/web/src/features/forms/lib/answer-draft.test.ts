import type { FormDefinition, RecordValues } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  createAnswerDraft,
  draftToAnswers,
  evaluateAnswerDraft,
  featuredMeasurementField,
  isQuickCompleteForm,
  quickCompleteAnswers,
  validateAnswerDraft,
} from "./answer-draft";

const GOODS_IN: FormDefinition = {
  correctiveAction: "required_on_fail",
  fields: [
    {
      id: "supplier",
      type: "text",
      label: "Supplier",
      required: true,
      multiline: false,
    },
    {
      id: "temp",
      type: "measurement",
      label: "Temperature",
      required: false,
      unit: "celsius",
      limits: { min: null, max: 5 },
    },
    {
      id: "packaging",
      type: "choice",
      label: "Packaging intact",
      required: true,
      multiple: false,
      options: [
        { id: "yes", label: "Yes", fails: false },
        { id: "no", label: "No", fails: true },
      ],
    },
    { id: "use_by", type: "date", label: "Use-by", required: false },
    { id: "checked", type: "checkbox", label: "Checked", required: false },
  ],
};

const FREEZER: FormDefinition = {
  correctiveAction: "required_on_fail",
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Temperature",
      required: true,
      unit: "celsius",
      limits: { min: -25, max: -18 },
    },
  ],
};

describe("createAnswerDraft", () => {
  it("starts a freezer reading negative from the occurrence's own limits", () => {
    const draft = createAnswerDraft(
      FREEZER,
      { temperature: { min: -25, max: -18 } },
      null,
      ",",
    );

    expect(draft.temperature).toEqual({
      type: "measurement",
      sign: -1,
      digits: "",
    });
  });

  it("prefills an edit from the stored answers, in the locale's separator", () => {
    const values: RecordValues = {
      temperature: {
        type: "measurement",
        value: -19.5,
        unit: "celsius",
        min: -25,
        max: -18,
        fails: false,
      },
    };

    const draft = createAnswerDraft(FREEZER, {}, values, ",");

    expect(draft.temperature).toEqual({
      type: "measurement",
      sign: -1,
      digits: "19,5",
    });
  });

  it("ignores a stored answer whose type no longer matches the field", () => {
    const draft = createAnswerDraft(
      GOODS_IN,
      {},
      { supplier: { type: "checkbox", value: true } },
      ".",
    );

    expect(draft.supplier).toEqual({ type: "text", value: "" });
  });
});

describe("draftToAnswers", () => {
  it("shapes each field the way the answer schema expects", () => {
    const draft = createAnswerDraft(GOODS_IN, {}, null, ".");
    draft.supplier = { type: "text", value: "Acme" };
    draft.temp = { type: "measurement", sign: 1, digits: "3.5" };
    draft.packaging = { type: "choice", value: ["yes"] };

    expect(draftToAnswers(GOODS_IN, draft)).toEqual({
      supplier: "Acme",
      temp: 3.5,
      packaging: "yes",
      use_by: null,
      checked: false,
    });
  });
});

describe("validateAnswerDraft", () => {
  it("flags required answers and malformed values per field", () => {
    const draft = createAnswerDraft(GOODS_IN, {}, null, ".");
    draft.temp = { type: "measurement", sign: 1, digits: "." };
    draft.use_by = { type: "date", value: "2026-02-30" };

    expect(validateAnswerDraft(GOODS_IN, draft)).toEqual({
      supplier: "required",
      temp: "invalid",
      packaging: "required",
      use_by: "invalid",
    });
  });

  it("lets optional fields stay empty", () => {
    const draft = createAnswerDraft(GOODS_IN, {}, null, ".");
    draft.supplier = { type: "text", value: "Acme" };
    draft.packaging = { type: "choice", value: ["yes"] };

    expect(validateAnswerDraft(GOODS_IN, draft)).toEqual({});
  });
});

describe("evaluateAnswerDraft", () => {
  it("fails on a failing option, as the server will", () => {
    const draft = createAnswerDraft(GOODS_IN, {}, null, ".");
    draft.packaging = { type: "choice", value: ["no"] };

    const evaluated = evaluateAnswerDraft(GOODS_IN, {}, draft);

    expect(evaluated.result).toBe("fail");
    expect(evaluated.failedFieldIds).toEqual(["packaging"]);
  });

  it("judges a measurement against the occurrence's limits, not the field defaults", () => {
    const draft = createAnswerDraft(FREEZER, {}, null, ".");
    draft.temperature = { type: "measurement", sign: -1, digits: "17" };

    expect(
      evaluateAnswerDraft(
        FREEZER,
        { temperature: { min: -25, max: -15 } },
        draft,
      ).result,
    ).toBe("pass");
    expect(
      evaluateAnswerDraft(
        FREEZER,
        { temperature: { min: -25, max: -18 } },
        draft,
      ).result,
    ).toBe("fail");
  });
});

describe("form shapes", () => {
  it("treats a lone required checkbox as a one-tap completion", () => {
    const cleaning: FormDefinition = {
      correctiveAction: "optional",
      fields: [
        { id: "cleaned", type: "checkbox", label: "Cleaned", required: true },
      ],
    };

    expect(isQuickCompleteForm(cleaning)).toBe(true);
    expect(quickCompleteAnswers(cleaning)).toEqual({ cleaned: true });
    expect(isQuickCompleteForm(GOODS_IN)).toBe(false);
  });

  it("features the measurement only when it is the whole form", () => {
    expect(featuredMeasurementField(FREEZER)?.id).toBe("temperature");
    expect(featuredMeasurementField(GOODS_IN)).toBeNull();
  });
});
