import { describe, expect, it } from "vitest";
import { summarizeTargetNames } from "./format-targets";

const more = (count: number) => `+${count}`;

describe("summarizeTargetNames", () => {
  it("is null for a template that is not tied to anything", () => {
    expect(summarizeTargetNames([], more)).toBeNull();
  });

  it("lists up to two names and counts the rest", () => {
    expect(summarizeTargetNames(["Fridge 1"], more)).toBe("Fridge 1");
    expect(summarizeTargetNames(["A", "B"], more)).toBe("A, B");
    expect(summarizeTargetNames(["A", "B", "C", "D"], more)).toBe("A, B +2");
  });
});
