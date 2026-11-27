import { resolveLimits, type ResolvedLimits } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { createRng, generateEntry, type AnswerContext } from "./answers.js";
import { SEED_FORMS, SEED_TARGETS, type SeedForm } from "./catalog.js";

const STAFF = ["Иван Петров", "Мария Георгиева"];

function formByKey(key: string): SeedForm {
  return SEED_FORMS.find((form) => form.key === key)!;
}

function contextFor(
  form: SeedForm,
  seed: string,
  overrides: Partial<AnswerContext> = {},
): AnswerContext {
  const definition = form.versions.at(-1)!.definition;
  return {
    form,
    definition,
    resolvedLimits: resolveLimits(definition, null),
    entryDate: "2026-11-20",
    staffNames: STAFF,
    rng: createRng(seed),
    ...overrides,
  };
}

describe("generateEntry", () => {
  it("reproduces the same entries from the same seed", () => {
    const form = formByKey("cooking");
    const first = generateEntry(contextFor(form, "same"));
    const second = generateEntry(contextFor(form, "same"));
    expect(second).toEqual(first);
  });

  it("fails roughly at the form's rate and always records a corrective action", () => {
    const form = { ...formByKey("sterilizer"), failRate: 0.5 };
    const rng = createRng("rate");
    const entries = Array.from({ length: 400 }, () =>
      generateEntry(contextFor(form, "unused", { rng })),
    );
    const failed = entries.filter((entry) => entry.result === "fail");

    expect(failed.length).toBeGreaterThan(140);
    expect(failed.length).toBeLessThan(260);
    for (const entry of failed) {
      expect(entry.corrective?.text).toBeTruthy();
      expect(entry.failedFieldIds.length).toBeGreaterThan(0);
    }
    for (const entry of entries.filter((e) => e.result !== "fail")) {
      expect(entry.corrective).toBeNull();
    }
  });

  it("judges against the item's own limits", () => {
    const form = { ...formByKey("storage"), failRate: 0 };
    const freezer = SEED_TARGETS.find((target) => target.key === "chamber1")!;
    const definition = form.versions.at(-1)!.definition;
    const resolvedLimits: ResolvedLimits = resolveLimits(definition, freezer.limits);
    const rng = createRng("freezer");

    for (let index = 0; index < 50; index += 1) {
      const entry = generateEntry(
        contextFor(form, "unused", {
          rng,
          resolvedLimits,
          typicalTemperature: freezer.typicalTemperature,
        }),
      );
      const reading = entry.values.temperature;
      expect(entry.result).toBe("pass");
      expect(reading?.type === "measurement" && reading.value! <= -12).toBe(true);
    }
  });

  it("names the employee a per-person check is about", () => {
    const entry = generateEntry(
      contextFor(formByKey("hygiene"), "person", { employeeName: "Елена Николова" }),
    );
    expect(entry.values.employee).toEqual({ type: "text", value: "Елена Николова" });
  });
});
