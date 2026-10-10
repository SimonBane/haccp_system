import { OpenAPIHono } from "@hono/zod-openapi";
import {
  targetInputSchema,
  targetListResponseSchema,
  targetResponseSchema,
} from "@haccp/shared";
import { registerAdminCrudRoutes } from "../../core/openapi/route-factory.js";
import type { AppEnv } from "../../types.js";
import { targetService } from "./target.service.js";

export const targetRoutes = new OpenAPIHono<AppEnv>();

registerAdminCrudRoutes({
  router: targetRoutes,
  tag: "Targets",
  schemas: {
    create: targetInputSchema,
    update: targetInputSchema,
    list: targetListResponseSchema,
    item: targetResponseSchema,
  },
  service: targetService,
});
