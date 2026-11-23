import { describe, expect, it } from "vitest";
import { correctiveFields, savedCorrective } from "./corrective-action";

describe("savedCorrective", () => {
  it("returns the answers and note as they were entered", () => {
    expect(
      savedCorrective({
        correctiveAction: "Moved product, Door was open",
        corrective: { answerIds: ["a_moved"], note: "Door was open" },
      }),
    ).toEqual({ answerIds: ["a_moved"], note: "Door was open" });
  });

  it("returns an older record's text as the note", () => {
    expect(
      savedCorrective({ correctiveAction: "Moved product", corrective: null }),
    ).toEqual({ answerIds: [], note: "Moved product" });
  });

  it("returns nothing for a record with no corrective action", () => {
    expect(savedCorrective({ correctiveAction: null })).toBeNull();
  });
});

describe("correctiveFields", () => {
  it("sends the note trimmed and the answers by id", () => {
    expect(
      correctiveFields({ answerIds: ["a_moved"], note: "  Door seal torn " }),
    ).toEqual({
      correctiveAction: "Door seal torn",
      correctiveAnswerIds: ["a_moved"],
    });
  });

  it("sends nothing for a passing check or an empty answer", () => {
    expect(correctiveFields(undefined)).toEqual({});
    expect(correctiveFields({ answerIds: [], note: "  " })).toEqual({
      correctiveAction: undefined,
      correctiveAnswerIds: undefined,
    });
  });
});
