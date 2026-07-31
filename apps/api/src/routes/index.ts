import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "../env.js";
import {
  requireAuth,
  requireOrg,
  requireOrgAdmin,
} from "../core/middleware/auth.js";
import { userContextMiddleware } from "../core/middleware/user-context.js";
import { tenantContextMiddleware } from "../core/middleware/tenant-context.js";
import { dbMiddleware } from "../core/middleware/db.js";
import { employeeRoutes } from "../modules/employees/employee.routes.js";
import { equipmentRoutes } from "../modules/equipment/equipment.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { locationRoutes } from "../modules/locations/location.routes.js";
import { organizationRoutes } from "../modules/organizations/organization.routes.js";
import { taskTemplateRoutes } from "../modules/task-templates/task-template.routes.js";
import { tenantRoutes } from "../modules/tenant/tenant.routes.js";
import { todayRoutes } from "../modules/today/today.routes.js";
import { clerkWebhookRoutes } from "../modules/webhooks/clerk-webhook.routes.js";
import { invitationRoutes } from "../modules/invitations/invitation.routes.js";
import type { AppEnv } from "../types.js";

export const routes = new OpenAPIHono<AppEnv>();

routes.use("*", dbMiddleware);

if (env.NODE_ENV === "development") {
  const { registerDevDocs } = await import("../core/openapi/dev-docs.js");
  await registerDevDocs(routes);
}

routes.route("/health", healthRoutes);
routes.route("/webhooks", clerkWebhookRoutes);

function mountOrgAuthOnly(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const router = new OpenAPIHono<AppEnv>();
  router.use("*", requireAuth);
  router.use("*", requireOrg);
  router.route("/", moduleRoutes);
  routes.route(path, router);
}

function mountProtected(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const protectedRouter = new OpenAPIHono<AppEnv>();
  protectedRouter.use("*", requireAuth);
  protectedRouter.use("*", userContextMiddleware);
  protectedRouter.use("*", requireOrg);
  protectedRouter.use("*", tenantContextMiddleware);
  protectedRouter.route("/", moduleRoutes);
  routes.route(path, protectedRouter);
}

function mountAdminProtected(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const adminRouter = new OpenAPIHono<AppEnv>();
  adminRouter.use("*", requireAuth);
  adminRouter.use("*", userContextMiddleware);
  adminRouter.use("*", requireOrg);
  adminRouter.use("*", requireOrgAdmin);
  adminRouter.use("*", tenantContextMiddleware);
  adminRouter.route("/", moduleRoutes);
  routes.route(path, adminRouter);
}

mountOrgAuthOnly("/invitations", invitationRoutes);
mountProtected("/tenant", tenantRoutes);
mountAdminProtected("/organizations", organizationRoutes);
mountAdminProtected("/employees", employeeRoutes);
mountAdminProtected("/locations", locationRoutes);
mountAdminProtected("/equipment", equipmentRoutes);
mountAdminProtected("/task-templates", taskTemplateRoutes);
mountProtected("/today", todayRoutes);
