import { createMiddleware } from "hono/factory";
import { getDb } from "../../lib/context.js";
import { tenantService } from "../../modules/tenant/tenant.service.js";
import type { AppEnv } from "../../types.js";

const LOCATION_HEADER = "x-location-id";

export const tenantContextMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const clerkOrgId = c.get("orgId");

    if (!clerkOrgId) {
      await next();
      return;
    }

    const requestedLocationId = c.req.header(LOCATION_HEADER);
    const tenant = await tenantService.resolveTenant(
      getDb(c),
      clerkOrgId,
      requestedLocationId,
    );

    c.set("organizationId", tenant.organizationId);
    c.set("currentOrganization", tenant.organization);
    c.set("tenantLocations", tenant.locations);
    c.set("currentLocation", tenant.currentLocation);

    await next();
  },
);
