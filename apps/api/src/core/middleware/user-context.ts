import { createMiddleware } from "hono/factory";
import { getDb } from "../../lib/context.js";
import { userService } from "../../modules/users/user.service.js";
import type { AppEnv } from "../../types.js";

export const userContextMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const clerkUserId = c.get("userId");
    const userDbId = await userService.resolveOrSyncUserDbId(
      getDb(c),
      clerkUserId,
    );

    if (userDbId) {
      c.set("userDbId", userDbId);
    }

    await next();
  },
);
