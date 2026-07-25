import { createMiddleware } from "hono/factory";
import { getDb } from "../../lib/context.js";
import { locationService } from "../../modules/locations/location.service.js";
import type { AppEnv } from "../../types.js";

export const currentLocationMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const orgId = c.get("orgId");

    if (orgId) {
      const location = await locationService.getCurrentLocation(getDb(c), orgId);
      c.set("currentLocation", location);
    }

    await next();
  },
);
