import { describe, expect, it } from "vitest";
import { buildAnswerFormatters } from "./answer-format";

describe("buildAnswerFormatters", () => {
  it("shows a missing answer as a plain hyphen, not a long dash", () => {
    const formatters = buildAnswerFormatters({
      locale: "en",
      symbol: () => "°C",
      yes: "Yes",
      no: "No",
    });

    expect(formatters.empty).toBe("-");
  });
});
