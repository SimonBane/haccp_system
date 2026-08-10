import { verifyToken } from "@clerk/backend";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { env } from "../../env.js";
import {
  isClerkMisconfiguration,
  isInvalidTokenError,
  withClerkTimeout,
} from "../auth/clerk-errors.js";
import {
  extractOrgIdFromPayload,
  extractOrgRoleFromPayload,
} from "../auth/clerk-token.js";
import {
  ForbiddenError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "../errors/app-errors.js";
import { logger } from "../../lib/logger.js";
import type { AppEnv } from "../../types.js";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");

  if (!token) {
    throw new UnauthorizedError();
  }

  let payload;
  try {
    // verifyToken fetches JWKS on a cold cache, and @clerk/backend sets no fetch
    // timeout — without this a hung connection hangs the request indefinitely.
    payload = await withClerkTimeout(
      verifyToken(token, { secretKey: env.CLERK_SECRET_KEY }),
    );
  } catch (error) {
    // Only a genuinely bad token is 401. The web app reads 401 as "signed out",
    // so blanket-catching here would turn a Clerk JWKS blip into a mass sign-out
    // of every tablet on the floor. Everything else is an upstream failure.
    if (isInvalidTokenError(error)) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    if (isClerkMisconfiguration(error)) {
      // Ours to fix, and silent otherwise — every request fails identically.
      logger.error({ err: error }, "Clerk secret key rejected during verification");
      throw new ServiceUnavailableError(
        "Could not verify your session. Please try again.",
      );
    }

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error({ err: error }, "Token verification failed upstream");
    throw new ServiceUnavailableError(
      "Could not verify your session. Please try again.",
    );
  }

  const claims = payload as Record<string, unknown>;

  c.set("userId", payload.sub);
  c.set("orgId", extractOrgIdFromPayload(claims));
  c.set("orgRole", extractOrgRoleFromPayload(claims));

  await next();
});

export function assertOrgAdmin(c: Context<AppEnv>): void {
  if (c.get("orgRole") !== "org:admin") {
    throw new ForbiddenError("Admin access required");
  }
}

export const requireOrgAdmin = createMiddleware<AppEnv>(async (c, next) => {
  assertOrgAdmin(c);
  await next();
});
