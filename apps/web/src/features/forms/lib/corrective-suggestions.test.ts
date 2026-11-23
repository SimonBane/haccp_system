import { describe, expect, it } from "vitest";
import {
  correctiveSuggestionsFor,
  unusedSuggestions,
} from "./corrective-suggestions";

describe("correctiveSuggestionsFor", () => {
  it("offers the thermostat only for temperature checks", () => {
    expect(correctiveSuggestionsFor("temperature")).toContain(
      "adjustedThermostat",
    );
    expect(correctiveSuggestionsFor("goods_in")).not.toContain(
      "adjustedThermostat",
    );
    expect(correctiveSuggestionsFor("goods_in")).toContain("rejectedDelivery");
  });

  it("falls back to the generic picks without a category", () => {
    expect(correctiveSuggestionsFor("")).toEqual(["rechecked", "notifiedManager"]);
  });
});

describe("unusedSuggestions", () => {
  it("leaves out what the form already has, however it was typed", () => {
    const suggestions = [{ label: "Moved product" }, { label: "Called service" }];

    expect(unusedSuggestions(suggestions, [" moved PRODUCT "])).toEqual([
      { label: "Called service" },
    ]);
  });
});
