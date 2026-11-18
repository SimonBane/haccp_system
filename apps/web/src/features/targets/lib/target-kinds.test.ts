import { describe, expect, it } from "vitest";
import { missingStarterTypes } from "./target-kinds";

describe("missingStarterTypes", () => {
  it("offers every starter type, in the admin's language, to a new organisation", () => {
    const suggestions = missingStarterTypes([], "bg");

    expect(suggestions.map((type) => type.key)).toEqual([
      "fridge",
      "freezer",
      "display_case",
      "room",
      "work_surface",
      "delivery_vehicle",
    ]);
    expect(suggestions[0]).toEqual({
      key: "fridge",
      name: "Хладилник",
      kind: "equipment",
    });
  });

  it("skips types the organisation already has, ignoring case and spacing", () => {
    const suggestions = missingStarterTypes(
      [{ name: " fridge " }, { name: "ROOM" }],
      "en",
    );

    expect(suggestions.map((type) => type.key)).toEqual([
      "freezer",
      "display_case",
      "work_surface",
      "delivery_vehicle",
    ]);
  });
});
