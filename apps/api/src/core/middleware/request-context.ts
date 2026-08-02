import { createMiddleware } from "hono/factory";
import { ForbiddenError } from "../errors/app-errors.js";
import { getDb } from "../../lib/context.js";
import { employeeService } from "../../modules/employees/employee.service.js";
import { tenantService } from "../../modules/tenant/tenant.service.js";
import { userService } from "../../modules/users/user.service.js";
import type { AppEnv } from "../../types.js";

export const requestContextMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const clerkOrgId = c.get("orgId");

    if (!clerkOrgId) {
      throw new ForbiddenError("Organization membership required");
    }

    const clerkUserId = c.get("userId");
    const orgRole = c.get("orgRole");
    const db = getDb(c);

    const [user, tenant] = await Promise.all([
      userService.resolveUser(db, clerkUserId),
      tenantService.requireTenant(db, clerkOrgId),
    ]);

    if (!user) {
      throw new ForbiddenError("User not found");
    }

    let assignedLocationIds: string[] | null = null;

    if (orgRole !== "org:admin") {
      assignedLocationIds = await employeeService.getAssignedLocationIdsForUser(
        db,
        tenant.organizationId,
        user.id,
      );

      if (assignedLocationIds.length === 0) {
        throw new ForbiddenError(
          "No locations assigned. Contact your administrator.",
        );
      }
    }

    c.set("tenant", tenant);
    c.set("user", user);
    c.set("assignedLocationIds", assignedLocationIds);

    await next();
  },
);
