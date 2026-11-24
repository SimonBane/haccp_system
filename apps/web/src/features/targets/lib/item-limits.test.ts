import { describe, expect, it } from "vitest";
import {
  emptyRange,
  limitsFromRanges,
  nextFreeParameter,
  rangesFromLimits,
  storedRanges,
} from "./item-limits";

describe("rangesFromLimits", () => {
  it("starts an item without a range from one empty temperature row", () => {
    expect(rangesFromLimits({}, ",")).toEqual([emptyRange("temperature")]);
  });

  it("opens stored ranges in the locale's separator, empty where a side is open", () => {
    expect(
      rangesFromLimits(
        {
          humidity: { min: 80.5, max: null },
          temperature: { min: null, max: -12 },
        },
        ",",
      ),
    ).toEqual([
      { parameter: "temperature", min: "", max: "-12" },
      { parameter: "humidity", min: "80,5", max: "" },
    ]);
  });
});

describe("limitsFromRanges", () => {
  it("keeps one-sided ranges and drops a row left empty", () => {
    expect(
      limitsFromRanges([
        { parameter: "temperature", min: "-0,5", max: "" },
        { parameter: "humidity", min: "", max: "" },
      ]),
    ).toEqual({
      limits: { temperature: { min: -0.5, max: null } },
      issues: {},
    });
  });

  it("flags a reversed range, an unreadable bound and one beyond the parameter's unit", () => {
    expect(
      limitsFromRanges([
        { parameter: "temperature", min: "8", max: "7" },
        { parameter: "humidity", min: "-", max: "" },
      ]).issues,
    ).toEqual({ 0: "order", 1: "min_out_of_range" });
    expect(
      limitsFromRanges([{ parameter: "humidity", min: "", max: "150" }]).issues,
    ).toEqual({ 0: "max_out_of_range" });
  });
});

describe("nextFreeParameter", () => {
  it("offers each measurement an item can hold a range for, then nothing", () => {
    expect(nextFreeParameter([])).toBe("temperature");
    expect(nextFreeParameter([emptyRange("temperature")])).toBe("humidity");
    expect(
      nextFreeParameter([emptyRange("temperature"), emptyRange("humidity")]),
    ).toBeNull();
  });
});

describe("storedRanges", () => {
  it("lists ranges in catalog order with each one's unit", () => {
    expect(
      storedRanges({
        humidity: { min: 80, max: 90 },
        temperature: { min: 0, max: 4 },
      }).map(({ parameter, unit }) => [parameter, unit]),
    ).toEqual([
      ["temperature", "celsius"],
      ["humidity", "percent"],
    ]);
  });
});
