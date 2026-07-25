import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "../env.js";
import {
  requireAuth,
  requireOrg,
} from "../core/middleware/auth.js";
import { dbMiddleware } from "../core/middleware/db.js";
import { equipmentRoutes } from "../modules/equipment/equipment.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { locationRoutes } from "../modules/locations/location.routes.js";
import { meRoutes } from "../modules/me/me.routes.js";
import { taskTemplateRoutes } from "../modules/task-templates/task-template.routes.js";
import { todayRoutes } from "../modules/today/today.routes.js";
import type { AppEnv } from "../types.js";

export const routes = new OpenAPIHono<AppEnv>();

routes.use("*", dbMiddleware);

if (env.NODE_ENV === "development") {
  const { registerDevDocs } = await import("../core/openapi/dev-docs.js");
  await registerDevDocs(routes);
}

routes.route("/health", healthRoutes);

function mountProtected(
  path: string,
  moduleRoutes: OpenAPIHono<AppEnv>,
): void {
  const protectedRouter = new OpenAPIHono<AppEnv>();
  protectedRouter.use("*", requireAuth);
  protectedRouter.use("*", requireOrg);
  protectedRouter.route("/", moduleRoutes);
  routes.route(path, protectedRouter);
}

mountProtected("/me", meRoutes);
mountProtected("/locations", locationRoutes);
mountProtected("/equipment", equipmentRoutes);
mountProtected("/task-templates", taskTemplateRoutes);
mountProtected("/today", todayRoutes);
