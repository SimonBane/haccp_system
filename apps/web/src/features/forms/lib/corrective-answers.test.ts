import { describe, expect, it } from "vitest";
import { toggleCorrectiveAnswer } from "./corrective-answers";

describe("toggleCorrectiveAnswer", () => {
  it("adds and removes an answer when several are allowed", () => {
    expect(toggleCorrectiveAnswer(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleCorrectiveAnswer(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("replaces the choice when only one is allowed, and clears it when picked again", () => {
    expect(toggleCorrectiveAnswer(["a"], "b", false)).toEqual(["b"]);
    expect(toggleCorrectiveAnswer(["b"], "b", false)).toEqual([]);
  });
});
