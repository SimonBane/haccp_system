import { describe, expect, it } from "vitest";
import { formDefinitionSchema } from "../schemas/form.js";
import { getStarterForms } from "./form-library.js";

describe("getStarterForms", () => {
  it.each(["bg", "en"] as const)("builds valid %s definitions", (locale) => {
    for (const starter of getStarterForms(locale)) {
      expect(formDefinitionSchema.safeParse(starter.definition).success).toBe(
        true,
      );
    }
  });

  it("keeps field ids identical across languages", () => {
    const bg = getStarterForms("bg");
    const en = getStarterForms("en");

    expect(bg.map((starter) => starter.key)).toEqual(
      en.map((starter) => starter.key),
    );
    bg.forEach((starter, index) => {
      expect(starter.definition.fields.map((field) => field.id)).toEqual(
        en[index]!.definition.fields.map((field) => field.id),
      );
    });
  });

  it("names forms in the requested language", () => {
    expect(
      getStarterForms("bg").find((s) => s.key === "fridge_check")?.name,
    ).toBe("Проверка на хладилник");
    expect(
      getStarterForms("en").find((s) => s.key === "fridge_check")?.name,
    ).toBe("Fridge check");
  });
});
