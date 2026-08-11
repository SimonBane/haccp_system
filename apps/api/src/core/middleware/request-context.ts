import { createMiddleware } from "hono/factory";
import { ForbiddenError } from "../errors/app-errors.js";
import { getDb } from "../../lib/context.js";
import { provisioningService } from "../../modules/provisioning/provisioning.service.js";
import type { AppEnv } from "../../types.js";

export const requestContextMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const clerkOrgId = c.get("orgId");
    if (!clerkOrgId) {
      throw new ForbiddenError("Organization membership required");
    }

    const orgRole = c.get("orgRole");
    const isAdmin = orgRole === "org:admin";

    const { tenant, user, membership } =
      await provisioningService.resolveRequestContext(getDb(c), {
        clerkOrgId,
        clerkUserId: c.get("userId"),
        orgRole,
      });

    if (!isAdmin && membership.locationIds.length === 0) {
      throw new ForbiddenError(
        "No locations assigned. Contact your administrator.",
      );
    }

    c.set("tenant", tenant);
    c.set("user", user);
    c.set("membership", membership);
    // null means "all locations" — filterAccessibleLocations and
    // locationParamMiddleware both key off that.
    c.set("assignedLocationIds", isAdmin ? null : membership.locationIds);

    await next();
  },
);
