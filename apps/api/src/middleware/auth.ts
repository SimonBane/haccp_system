import { verifyToken } from "@clerk/backend";
import { createMiddleware } from "hono/factory";
import { env } from "../env.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { AppEnv } from "../types.js";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");

  if (!token) {
    throw new UnauthorizedError();
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    c.set("userId", payload.sub);
    c.set("orgId", (payload.org_id as string | undefined) ?? null);
    c.set("orgRole", (payload.org_role as string | undefined) ?? null);
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
