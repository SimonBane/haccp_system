import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "https://api.example.test" },
}));

import {
  ApiRequestError,
  WEB_API_ERROR_CODE,
  networkRequestError,
  parseApiJson,
  throwIfApiError,
} from "./api-utils.js";

describe("API response normalization", () => {
  it("preserves the standard API error metadata", async () => {
    const response = new Response(
      JSON.stringify({
        error: "LOCATION_NAME_EXISTS",
        message: "A location with this name already exists",
        details: { field: "name" },
        requestId: "request-123",
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );

    await expect(throwIfApiError(response)).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "LOCATION_NAME_EXISTS",
      kind: "api",
      status: 409,
      requestId: "request-123",
      details: { field: "name" },
    });
  });

  it("normalizes a malformed error response", async () => {
    const response = new Response("not-json", { status: 500 });

    await expect(throwIfApiError(response)).rejects.toMatchObject({
      code: WEB_API_ERROR_CODE.INVALID_ERROR_RESPONSE,
      kind: "invalid_error_response",
      status: 500,
    });
  });

  it("normalizes invalid success JSON", async () => {
    const response = new Response("not-json", { status: 200 });

    await expect(
      parseApiJson(response, z.object({ ok: z.boolean() })),
    ).rejects.toMatchObject({
      code: WEB_API_ERROR_CODE.INVALID_RESPONSE,
      kind: "invalid_response",
      status: 200,
    });
  });

  it("normalizes a success payload that violates its schema", async () => {
    const response = new Response(JSON.stringify({ ok: "yes" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    await expect(
      parseApiJson(response, z.object({ ok: z.boolean() })),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("normalizes network failures without exposing their message", () => {
    const error = networkRequestError(new Error("socket secret"));

    expect(error).toMatchObject({
      code: WEB_API_ERROR_CODE.NETWORK,
      kind: "network",
      status: undefined,
    });
    expect(error.message).not.toContain("socket secret");
  });
});
