import { describe, expect, it } from "vitest";
import {
  composeCorrectiveAction,
  correctivePresetsFor,
} from "./corrective-action";

describe("correctivePresetsFor", () => {
  it("offers the thermostat only for temperature checks", () => {
    expect(correctivePresetsFor("temperature")).toContain("adjustedThermostat");
    expect(correctivePresetsFor("goods_in")).not.toContain(
      "adjustedThermostat",
    );
    expect(correctivePresetsFor("goods_in")).toContain("rejectedDelivery");
  });

  it("falls back to the generic picks without a category", () => {
    expect(correctivePresetsFor(null)).toEqual(correctivePresetsFor("other"));
  });
});

describe("composeCorrectiveAction", () => {
  it("joins picked presets and trimmed notes", () => {
    expect(
      composeCorrectiveAction(
        ["Moved product", "Notified manager"],
        "  Door seal torn ",
      ),
    ).toBe("Moved product, Notified manager, Door seal torn");
    expect(composeCorrectiveAction([], "   ")).toBe("");
  });
});
