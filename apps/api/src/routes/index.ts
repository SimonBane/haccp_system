import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { equipmentRoutes } from "./equipment.js";
import { healthRoutes } from "./health.js";
import { locationRoutes } from "./locations.js";
import { meRoutes } from "./me.js";
import { taskTemplateRoutes } from "./task-templates.js";
import { todayRoutes } from "./today.js";
import type { AppEnv } from "../types.js";

export const routes = new OpenAPIHono<AppEnv>();

routes.route("/health", healthRoutes);

const protectedRoutes = new OpenAPIHono<AppEnv>();
protectedRoutes.use("*", requireAuth);
protectedRoutes.use("*", requireOrg);
protectedRoutes.route("/me", meRoutes);
protectedRoutes.route("/locations", locationRoutes);
protectedRoutes.route("/equipment", equipmentRoutes);
protectedRoutes.route("/task-templates", taskTemplateRoutes);
protectedRoutes.route("/today", todayRoutes);

routes.route("/", protectedRoutes);
