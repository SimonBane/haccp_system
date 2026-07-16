import {
  createTaskTemplateSchema,
  taskTemplateListResponseSchema,
  taskTemplateResponseSchema,
  updateTaskTemplateSchema,
} from "@haccp/shared";
import { OpenAPIHono } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireOrgAdmin } from "../middleware/auth.js";
import { taskTemplateService } from "../services/task-template.service.js";
import type { AppEnv } from "../types.js";

const taskTemplateIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const taskTemplateRoutes = new OpenAPIHono<AppEnv>();

taskTemplateRoutes.get("/", async (c) => {
  const orgId = c.get("orgId")!;
  const result = await taskTemplateService.list(db, orgId);

  return c.json(taskTemplateListResponseSchema.parse(result), 200);
});

taskTemplateRoutes.post(
  "/",
  requireOrgAdmin,
  zValidator("json", createTaskTemplateSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const input = c.req.valid("json");
    const created = await taskTemplateService.create(db, orgId, input);

    return c.json(taskTemplateResponseSchema.parse(created), 201);
  },
);

taskTemplateRoutes.patch(
  "/:id",
  requireOrgAdmin,
  zValidator("param", taskTemplateIdParamSchema),
  zValidator("json", updateTaskTemplateSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const updated = await taskTemplateService.update(db, orgId, id, input);

    return c.json(taskTemplateResponseSchema.parse(updated), 200);
  },
);

taskTemplateRoutes.delete(
  "/:id",
  requireOrgAdmin,
  zValidator("param", taskTemplateIdParamSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const { id } = c.req.valid("param");
    await taskTemplateService.delete(db, orgId, id);

    return c.body(null, 204);
  },
);
