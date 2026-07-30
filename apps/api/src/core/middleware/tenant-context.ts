import { createMiddleware } from "hono/factory";
import { ForbiddenError } from "../errors/app-errors.js";
import { getDb } from "../../lib/context.js";
import { employeeService } from "../../modules/employees/employee.service.js";
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

    const orgRole = c.get("orgRole");
    const userDbId = c.get("userDbId");
    const isAdmin = orgRole === "org:admin";
    let locations = tenant.locations;
    let currentLocation = tenant.currentLocation;

    if (!isAdmin && userDbId) {
      const assignedLocationIds =
        await employeeService.getAssignedLocationIdsForUser(
          getDb(c),
          tenant.organizationId,
          userDbId,
        );

      if (assignedLocationIds.length === 0) {
        throw new ForbiddenError(
          "No locations assigned. Contact your administrator.",
        );
      }

      const assignedSet = new Set(assignedLocationIds);
      locations = tenant.locations.filter((location) =>
        assignedSet.has(location.id),
      );

      if (locations.length === 0) {
        throw new ForbiddenError(
          "No locations assigned. Contact your administrator.",
        );
      }

      if (requestedLocationId && !assignedSet.has(requestedLocationId)) {
        throw new ForbiddenError("You do not have access to this location");
      }

      currentLocation =
        locations.find((location) => location.id === requestedLocationId) ??
        locations.find((location) => location.isDefault) ??
        locations[0]!;
    }

    c.set("organizationId", tenant.organizationId);
    c.set("currentOrganization", tenant.organization);
    c.set("tenantLocations", locations);
    c.set("currentLocation", currentLocation);

    await next();
  },
);
