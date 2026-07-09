import { OpenAPIHono } from "@hono/zod-openapi";
import { healthRoutes } from "./health.js";
import type { AppEnv } from "../types.js";

export const routes = new OpenAPIHono<AppEnv>();

routes.route("/health", healthRoutes);
