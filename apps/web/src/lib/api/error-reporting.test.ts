import { API_ERROR_CODE } from "@haccp/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "https://api.example.test" },
}));

vi.mock("@/lib/sentry", () => ({
  isSentryEnabled: () => true,
}));

import { ApiRequestError, WEB_API_ERROR_CODE } from "./api-utils.js";
import { shouldReportUnexpectedWebError } from "./error-reporting.js";

describe("shouldReportUnexpectedWebError", () => {
  it("does not report expected API, network, or unavailable failures", () => {
    const apiError = new ApiRequestError("safe", {
      code: API_ERROR_CODE.INTERNAL,
      kind: "api",
      status: 500,
      requestId: "request-500",
    });
    const networkError = new ApiRequestError("safe", {
      code: WEB_API_ERROR_CODE.NETWORK,
      kind: "network",
    });

    expect(shouldReportUnexpectedWebError(apiError)).toBe(false);
    expect(shouldReportUnexpectedWebError(networkError)).toBe(false);
  });

  it("reports response-contract failures and unexpected client errors", () => {
    const contractError = new ApiRequestError("safe", {
      code: WEB_API_ERROR_CODE.INVALID_RESPONSE,
      kind: "invalid_response",
      status: 200,
    });

    expect(shouldReportUnexpectedWebError(contractError)).toBe(true);
    expect(shouldReportUnexpectedWebError(new Error("render failed"))).toBe(
      true,
    );
  });
});
