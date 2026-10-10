import { describe, expect, it } from "vitest";
import {
  formatLimits,
  formatMeasurementDraft,
  inferMeasurementSign,
  measurementVerdict,
  parseMeasurementDraft,
  sanitizeMeasurementDraft,
} from "./measurement";

describe("sanitizeMeasurementDraft", () => {
  it("normalises a pasted typographic minus and keeps one decimal for °C", () => {
    expect(sanitizeMeasurementDraft("−19,25", ",", "celsius")).toBe("-19,2");
  });

  it("drops the minus for a unit that cannot go below zero", () => {
    expect(sanitizeMeasurementDraft("-7.5", ".", "ph")).toBe("7.5");
  });

  it("allows the unit's precision: three decimals for water activity", () => {
    expect(sanitizeMeasurementDraft("0.9876", ".", "water_activity")).toBe(
      "0.987",
    );
  });

  it("refuses a decimal separator for whole-number units", () => {
    expect(sanitizeMeasurementDraft("12.5", ".", "minutes")).toBe("125");
  });

  it("caps integer digits at what the unit's range can hold", () => {
    expect(sanitizeMeasurementDraft("1234", ".", "celsius")).toBe("12");
  });

  it("strips a mistyped leading zero but keeps a real 0,5", () => {
    expect(sanitizeMeasurementDraft("08", ",", "celsius")).toBe("8");
    expect(sanitizeMeasurementDraft("0,5", ",", "celsius")).toBe("0,5");
  });
});

describe("parseMeasurementDraft", () => {
  it("reads a comma draft and returns null while still being typed", () => {
    expect(parseMeasurementDraft("-3,5")).toBe(-3.5);
    expect(parseMeasurementDraft("-")).toBeNull();
    expect(parseMeasurementDraft("4,")).toBeNull();
  });

  it("coerces negative zero to zero", () => {
    expect(Object.is(parseMeasurementDraft("-0"), 0)).toBe(true);
  });
});

describe("formatMeasurementDraft", () => {
  it("rounds to the unit's precision with the locale separator", () => {
    expect(formatMeasurementDraft(7.256, ",", "ph")).toBe("7,26");
  });
});

describe("inferMeasurementSign", () => {
  it("starts negative only for a band entirely or mostly below zero", () => {
    expect(inferMeasurementSign({ min: -25, max: -18 }, "celsius")).toBe(-1);
    expect(inferMeasurementSign({ min: -1, max: 4 }, "celsius")).toBe(1);
    expect(inferMeasurementSign({ min: null, max: -18 }, "celsius")).toBe(-1);
    expect(inferMeasurementSign({ min: 63, max: null }, "celsius")).toBe(1);
  });

  it("is always positive for a unit with no negatives", () => {
    expect(inferMeasurementSign({ min: -5, max: -1 }, "percent")).toBe(1);
  });
});

describe("measurementVerdict", () => {
  it("judges against one-sided limits", () => {
    expect(measurementVerdict(60, { min: 63, max: null })).toBe("fail");
    expect(measurementVerdict(70, { min: 63, max: null })).toBe("pass");
  });

  it("has nothing to say without a value or without limits", () => {
    expect(measurementVerdict(null, { min: 0, max: 4 })).toBeNull();
    expect(measurementVerdict(5, { min: null, max: null })).toBeNull();
  });
});

describe("formatLimits", () => {
  it("renders a band, a floor and a ceiling", () => {
    expect(formatLimits({ min: 0, max: 4 }, "celsius", "en", "°C")).toBe(
      "0 – 4 °C",
    );
    expect(formatLimits({ min: 63, max: null }, "celsius", "en", "°C")).toBe(
      "≥ 63 °C",
    );
    expect(formatLimits({ min: null, max: 24 }, "percent", "bg", "%")).toBe(
      "≤ 24 %",
    );
    expect(
      formatLimits({ min: null, max: null }, "celsius", "en", "°C"),
    ).toBeNull();
  });
});
