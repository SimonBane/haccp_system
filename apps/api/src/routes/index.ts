import { Hono } from "hono";
import { healthRoutes } from "./health.js";
import type { AppEnv } from "../types.js";

export const routes = new Hono<AppEnv>();

routes.route("/health", healthRoutes);
