import { describe, expect, it } from "vitest";
import { hasMultipleLocations } from "./multiple-locations";

describe("hasMultipleLocations", () => {
  it("is false when the feature is off, however many locations exist", () => {
    expect(
      hasMultipleLocations({ multipleLocationsEnabled: false }, [1, 2]),
    ).toBe(false);
  });

  it("is false when the feature is on but only one location exists", () => {
    expect(hasMultipleLocations({ multipleLocationsEnabled: true }, [1])).toBe(
      false,
    );
  });

  it("is true when the feature is on and more than one location exists", () => {
    expect(
      hasMultipleLocations({ multipleLocationsEnabled: true }, [1, 2]),
    ).toBe(true);
  });
});
