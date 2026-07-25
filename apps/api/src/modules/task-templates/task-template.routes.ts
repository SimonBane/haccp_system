import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createTaskTemplateSchema,
  taskTemplateListResponseSchema,
  taskTemplateResponseSchema,
  updateTaskTemplateSchema,
} from "@haccp/shared";
import { registerAdminCrudRoutes } from "../../core/openapi/route-factory.js";
import type { AppEnv } from "../../types.js";
import { taskTemplateService } from "./task-template.service.js";

export const taskTemplateRoutes = new OpenAPIHono<AppEnv>();

registerAdminCrudRoutes({
  router: taskTemplateRoutes,
  tag: "Task Templates",
  schemas: {
    create: createTaskTemplateSchema,
    update: updateTaskTemplateSchema,
    list: taskTemplateListResponseSchema,
    item: taskTemplateResponseSchema,
  },
  service: taskTemplateService,
});
