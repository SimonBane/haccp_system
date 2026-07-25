import { verifyToken } from "@clerk/backend";
import { createMiddleware } from "hono/factory";
import { env } from "../../env.js";
import {
  extractOrgIdFromPayload,
  extractOrgRoleFromPayload,
} from "../auth/clerk-token.js";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../errors/app-errors.js";
import type { AppEnv } from "../../types.js";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");

  if (!token) {
    throw new UnauthorizedError();
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    const claims = payload as Record<string, unknown>;

    c.set("userId", payload.sub);
    c.set("orgId", extractOrgIdFromPayload(claims));
    c.set("orgRole", extractOrgRoleFromPayload(claims));
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  await next();
});

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("orgId")) {
    throw new ForbiddenError("Organization membership required");
  }

  await next();
});

export const requireOrgAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("orgRole") !== "org:admin") {
    throw new ForbiddenError("Admin access required");
  }

  await next();
});
