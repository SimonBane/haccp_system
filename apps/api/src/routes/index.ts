import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { healthRoutes } from "./health.js";
import { meRoutes } from "./me.js";
import type { AppEnv } from "../types.js";

export const routes = new OpenAPIHono<AppEnv>();

routes.route("/health", healthRoutes);

const protectedRoutes = new OpenAPIHono<AppEnv>();
protectedRoutes.use("*", requireAuth);
protectedRoutes.use("*", requireOrg);
protectedRoutes.route("/me", meRoutes);

routes.route("/", protectedRoutes);
