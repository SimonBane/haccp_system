import {
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../types.js";

const verifyToken = vi.hoisted(() => vi.fn());
vi.mock("@clerk/backend", () => ({ verifyToken }));

const { requireAuth } = await import("./auth.js");
const { errorHandler } = await import("./error-handler.js");

/**
 * The 401/503 split is the whole point of this middleware's error handling.
 *
 * The web app treats 401 as "signed out" and bounces to Clerk, so reporting one
 * for a JWKS fetch failure would sign every kitchen tablet out at once during a
 * Clerk blip. Only a genuinely bad token may be 401.
 */
function tokenError(reason: string): TokenVerificationError {
  return new TokenVerificationError({ message: "nope", reason });
}

function app() {
  const instance = new Hono<AppEnv>();
  instance.onError(errorHandler);
  instance.get("/probe", requireAuth, (c) => c.json({ ok: true }));
  return instance;
}

function get(headers: Record<string, string> = {}) {
  return app().request("/probe", { headers });
}

const AUTHED = { Authorization: "Bearer some-token" };

beforeEach(() => {
  verifyToken.mockReset();
});

describe("requireAuth", () => {
  it("401s when no Authorization header is present", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("passes the verified claims through on success", async () => {
    verifyToken.mockResolvedValue({ sub: "user_1", org_id: "org_1", org_role: "org:admin" });

    const res = await get(AUTHED);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  describe("401 — the caller's token is bad", () => {
    const invalidReasons = [
      TokenVerificationErrorReason.TokenExpired,
      TokenVerificationErrorReason.TokenInvalid,
      TokenVerificationErrorReason.TokenInvalidAlgorithm,
      TokenVerificationErrorReason.TokenInvalidAuthorizedParties,
      TokenVerificationErrorReason.TokenInvalidSignature,
      TokenVerificationErrorReason.TokenNotActiveYet,
      TokenVerificationErrorReason.TokenIatInTheFuture,
      TokenVerificationErrorReason.JWKKidMismatch,
    ];

    it.each(invalidReasons)("%s", async (reason) => {
      verifyToken.mockRejectedValue(tokenError(reason));

      const res = await get(AUTHED);
      expect(res.status).toBe(401);
    });
  });

  describe("503 — we could not verify", () => {
    const upstreamReasons = [
      TokenVerificationErrorReason.RemoteJWKFailedToLoad,
      TokenVerificationErrorReason.RemoteJWKInvalid,
      TokenVerificationErrorReason.RemoteJWKMissing,
      TokenVerificationErrorReason.JWKFailedToResolve,
      TokenVerificationErrorReason.LocalJWKMissing,
      TokenVerificationErrorReason.TokenVerificationFailed,
    ];

    it.each(upstreamReasons)("%s", async (reason) => {
      verifyToken.mockRejectedValue(tokenError(reason));

      const res = await get(AUTHED);
      // Not 401: a Clerk outage must not read as "signed out" to the web app.
      expect(res.status).toBe(503);
    });

    it("treats a bad secret key as our outage, not the caller's problem", async () => {
      verifyToken.mockRejectedValue(
        tokenError(TokenVerificationErrorReason.InvalidSecretKey),
      );

      const res = await get(AUTHED);
      expect(res.status).toBe(503);
    });

    it("503s on an unrecognised failure rather than guessing 401", async () => {
      verifyToken.mockRejectedValue(new Error("socket hang up"));

      const res = await get(AUTHED);
      expect(res.status).toBe(503);
    });

    it("503s rather than hanging when Clerk never answers", async () => {
      // withClerkTimeout rejects with ServiceUnavailableError after 5s; the
      // promise here never settles, so only the timeout can end the request.
      vi.useFakeTimers();
      verifyToken.mockReturnValue(new Promise(() => {}));

      const pending = get(AUTHED);
      await vi.advanceTimersByTimeAsync(6000);
      const res = await pending;

      expect(res.status).toBe(503);
      vi.useRealTimers();
    });
  });
});
