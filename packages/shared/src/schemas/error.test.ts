import { describe, expect, it } from "vitest";
import { apiErrorSchema } from "./error.js";

describe("apiErrorSchema", () => {
  it("requires a request id", () => {
    expect(
      apiErrorSchema.safeParse({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      }).success,
    ).toBe(false);
  });

  it("accepts validation details without prescribing their shape", () => {
    expect(
      apiErrorSchema.parse({
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        details: { properties: { name: { errors: ["Required"] } } },
        requestId: "request-123",
      }),
    ).toMatchObject({ requestId: "request-123" });
  });
});
