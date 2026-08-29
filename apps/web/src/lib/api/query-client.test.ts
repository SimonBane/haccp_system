import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "https://api.example.test" },
}));

import { ApiRequestError } from "./api-utils.js";
import { createQueryClient, shouldRetryQuery } from "./query-client.js";

function requestError(status: number) {
  return new ApiRequestError("safe", {
    code: status >= 500 ? "INTERNAL_SERVER_ERROR" : "VALIDATION_ERROR",
    kind: "api",
    status,
    requestId: `request-${status}`,
  });
}

describe("query error policy", () => {
  it("retries network and 5xx failures once, but never retries 4xx", () => {
    expect(shouldRetryQuery(0, requestError(400))).toBe(false);
    expect(shouldRetryQuery(0, requestError(500))).toBe(true);
    expect(
      shouldRetryQuery(
        0,
        new ApiRequestError("offline", {
          code: "NETWORK_ERROR",
          kind: "network",
        }),
      ),
    ).toBe(true);
    expect(shouldRetryQuery(1, requestError(500))).toBe(false);
  });

  it("shows mutation errors globally unless the mutation handles them", async () => {
    const showError = vi.fn();
    const client = createQueryClient({ showError });
    const error = requestError(400);

    await expect(
      client
        .getMutationCache()
        .build(client, { mutationFn: async () => Promise.reject(error) })
        .execute(undefined),
    ).rejects.toBe(error);
    expect(showError).toHaveBeenCalledOnce();

    showError.mockClear();
    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => Promise.reject(error),
          meta: { handlesError: true },
        })
        .execute(undefined),
    ).rejects.toBe(error);
    expect(showError).not.toHaveBeenCalled();
  });

  it("toasts failed background refreshes but not failed initial loads", async () => {
    const showError = vi.fn();
    const client = createQueryClient({ showError });
    const error = requestError(400);

    await expect(
      client.fetchQuery({
        queryKey: ["initial"],
        queryFn: async () => Promise.reject(error),
      }),
    ).rejects.toBe(error);
    expect(showError).not.toHaveBeenCalled();

    client.setQueryData(["background"], { ok: true });
    await expect(
      client.fetchQuery({
        queryKey: ["background"],
        queryFn: async () => Promise.reject(error),
        staleTime: 0,
      }),
    ).rejects.toBe(error);
    expect(showError).toHaveBeenCalledOnce();
  });
});
