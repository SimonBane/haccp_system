import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "../env.js";
import {
  requireAuth,
  requireOrgAdmin,
} from "../core/middleware/auth.js";
import { locationParamMiddleware } from "../core/middleware/location-context.js";
import { requestContextMiddleware } from "../core/middleware/request-context.js";
import { dbMiddleware } from "../core/middleware/db.js";
import { employeeRoutes } from "../modules/employees/employee.routes.js";
import { equipmentRoutes } from "../modules/equipment/equipment.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { locationRoutes } from "../modules/locations/location.routes.js";
import { organizationRoutes } from "../modules/organizations/organization.routes.js";
import { taskTemplateRoutes } from "../modules/task-templates/task-template.routes.js";
import { tenantRoutes } from "../modules/tenant/tenant.routes.js";
import { todayRoutes } from "../modules/today/today.routes.js";
import { invitationRoutes } from "../modules/invitations/invitation.routes.js";
import type { AppEnv } from "../types.js";

export const routes = new OpenAPIHono<AppEnv>();

routes.use("*", dbMiddleware);

if (env.NODE_ENV === "development") {
  const { registerDevDocs } = await import("../core/openapi/dev-docs.js");
  await registerDevDocs(routes);
}

routes.route("/health", healthRoutes);

function mountAuthOnly(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireAuth);
  router.route("/", moduleRoutes);
  routes.route(path, router);
}

function mountProtected(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const protectedRouter = new OpenAPIHono<AppEnv>();
  protectedRouter.use("*", requireAuth);
  protectedRouter.use("*", requestContextMiddleware);
  protectedRouter.route("/", moduleRoutes);
  routes.route(path, protectedRouter);
}

function mountAdminProtected(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const adminRouter = new OpenAPIHono<AppEnv>();
  adminRouter.use("*", requireAuth);
  adminRouter.use("*", requestContextMiddleware);
  adminRouter.use("*", requireOrgAdmin);
  adminRouter.route("/", moduleRoutes);
  routes.route(path, adminRouter);
}

function mountLocationScoped(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
  adminOnly: boolean,
): void {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireAuth);
  router.use("*", requestContextMiddleware);
  if (adminOnly) {
    router.use("*", requireOrgAdmin);
  }
  router.use("*", locationParamMiddleware);
  router.route("/", moduleRoutes);
  routes.route(path, router);
}

mountAuthOnly("/invitations", invitationRoutes);
mountProtected("/tenant", tenantRoutes);
mountAdminProtected("/organizations", organizationRoutes);
mountAdminProtected("/employees", employeeRoutes);
// Location-scoped routes must be registered before the admin /locations
// router. Otherwise Hono runs admin middleware for every /locations/* path.
mountLocationScoped("/locations/:locationId/equipment", equipmentRoutes, true);
mountLocationScoped(
  "/locations/:locationId/task-templates",
  taskTemplateRoutes,
  true,
);
mountLocationScoped("/locations/:locationId/today", todayRoutes, false);
mountAdminProtected("/locations", locationRoutes);
