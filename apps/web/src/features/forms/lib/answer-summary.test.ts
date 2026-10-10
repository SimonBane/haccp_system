import type { FormDefinition, RecordValues } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  describeAnswers,
  primaryMeasurement,
  summarizeAnswers,
  type AnswerFormatters,
} from "./answer-summary";

const format: AnswerFormatters = {
  measurement: (value, unit) => `${value} ${unit === "celsius" ? "°C" : unit}`,
  date: (value) => value.split("-").reverse().join("."),
  yes: "Yes",
  no: "No",
  empty: "—",
};

const DEFINITION: FormDefinition = {
  correctiveAction: "required_on_fail",
  fields: [
    {
      id: "temp",
      type: "measurement",
      label: "Temperature",
      required: true,
      unit: "celsius",
      limits: { min: 0, max: 4 },
    },
    {
      id: "packaging",
      type: "choice",
      label: "Packaging",
      required: true,
      multiple: true,
      options: [
        { id: "dented", label: "Dented", fails: true },
        { id: "wet", label: "Wet", fails: true },
      ],
    },
    { id: "use_by", type: "date", label: "Use-by", required: false },
    { id: "door", type: "checkbox", label: "Door closed", required: false },
  ],
};

const VALUES: RecordValues = {
  door: { type: "checkbox", value: true },
  use_by: { type: "date", value: null },
  packaging: { type: "choice", value: ["wet", "dented"], fails: true },
  temp: {
    type: "measurement",
    value: 6,
    unit: "celsius",
    min: 0,
    max: 4,
    fails: true,
  },
};

describe("describeAnswers", () => {
  it("lists answers in field order with option labels and failures", () => {
    expect(describeAnswers(DEFINITION, VALUES, format)).toEqual([
      { fieldId: "temp", label: "Temperature", text: "6 °C", fails: true },
      {
        fieldId: "packaging",
        label: "Packaging",
        text: "Wet, Dented",
        fails: true,
      },
      { fieldId: "use_by", label: "Use-by", text: "—", fails: false },
      { fieldId: "door", label: "Door closed", text: "Yes", fails: false },
    ]);
  });

  it("falls back to field ids when the version is unknown", () => {
    expect(
      describeAnswers(
        null,
        { door: { type: "checkbox", value: false } },
        format,
      ),
    ).toEqual([{ fieldId: "door", label: "door", text: "No", fails: false }]);
  });
});

describe("summarizeAnswers", () => {
  it("drops the label for a single answer and joins several", () => {
    const lines = describeAnswers(DEFINITION, VALUES, format);

    expect(summarizeAnswers(lines.slice(0, 1))).toBe("6 °C");
    expect(summarizeAnswers(lines.slice(2))).toBe(
      "Use-by: — · Door closed: Yes",
    );
  });
});

describe("primaryMeasurement", () => {
  it("returns the first answered measurement", () => {
    expect(primaryMeasurement(VALUES)?.value).toBe(6);
    expect(
      primaryMeasurement({ door: { type: "checkbox", value: true } }),
    ).toBeNull();
    expect(primaryMeasurement(null)).toBeNull();
  });
});
