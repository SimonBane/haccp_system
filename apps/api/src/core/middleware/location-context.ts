import { createMiddleware } from "hono/factory";
import { ForbiddenError, InternalError } from "../errors/app-errors.js";
import { getTenant } from "../../lib/context.js";
import type { AppEnv } from "../../types.js";

export const locationParamMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const locationId = c.req.param("locationId");
    const tenant = getTenant(c);
    const assignedLocationIds = c.get("assignedLocationIds");

    if (!locationId) {
      throw new InternalError("Location id path parameter is required");
    }

    const location = tenant.locations.find((entry) => entry.id === locationId);

    if (!location) {
      throw new ForbiddenError("You do not have access to this location");
    }

    if (assignedLocationIds && !assignedLocationIds.includes(locationId)) {
      throw new ForbiddenError("You do not have access to this location");
    }

    c.set("currentLocation", location);

    await next();
  },
);
