import { API_ERROR_CODE } from "@haccp/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "https://api.example.test" },
}));

import { ApiRequestError } from "./api-utils.js";
import { getApiErrorPresentation } from "./error-presentation.js";

const t = (key: string, values?: { requestId: string }) =>
  values ? `${key}:${values.requestId}` : key;

describe("getApiErrorPresentation", () => {
  it("translates actionable business codes instead of API messages", () => {
    const error = new ApiRequestError("raw English API message", {
      code: API_ERROR_CODE.EQUIPMENT_NAME_EXISTS,
      kind: "api",
      status: 409,
      requestId: "request-1",
    });

    expect(getApiErrorPresentation(error, t)).toEqual({
      message: "codes.equipmentNameExists",
    });
  });

  it("uses safe category fallbacks for unknown API codes", () => {
    const error = new ApiRequestError("sensitive internal message", {
      code: "UNKNOWN_CONFLICT",
      kind: "api",
      status: 409,
      requestId: "request-2",
    });

    expect(getApiErrorPresentation(error, t).message).toBe("conflict");
  });

  it("shows a request reference only for unexpected 5xx errors", () => {
    const serverError = new ApiRequestError("safe", {
      code: API_ERROR_CODE.INTERNAL,
      kind: "api",
      status: 500,
      requestId: "request-500",
    });
    const validationError = new ApiRequestError("safe", {
      code: API_ERROR_CODE.VALIDATION,
      kind: "api",
      status: 400,
      requestId: "request-400",
    });
    const unavailableError = new ApiRequestError("safe", {
      code: API_ERROR_CODE.SERVICE_UNAVAILABLE,
      kind: "api",
      status: 503,
      requestId: "request-503",
    });

    expect(getApiErrorPresentation(serverError, t)).toEqual({
      message: "generic",
      description: "reference:request-500",
    });
    expect(getApiErrorPresentation(validationError, t)).toEqual({
      message: "validation",
    });
    expect(getApiErrorPresentation(unavailableError, t)).toEqual({
      message: "unavailable",
    });
  });

  it("never renders an arbitrary Error message", () => {
    expect(getApiErrorPresentation(new Error("database password"), t)).toEqual({
      message: "generic",
    });
  });
});
