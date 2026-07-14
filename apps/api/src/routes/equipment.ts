import {
  createEquipmentSchema,
  equipmentListResponseSchema,
  equipmentResponseSchema,
  updateEquipmentSchema,
} from "@haccp/shared";
import { OpenAPIHono } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireOrgAdmin } from "../middleware/auth.js";
import { equipmentService } from "../services/equipment.service.js";
import type { AppEnv } from "../types.js";

const equipmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const equipmentRoutes = new OpenAPIHono<AppEnv>();

equipmentRoutes.get("/", async (c) => {
  const orgId = c.get("orgId")!;
  const result = await equipmentService.list(db, orgId);

  return c.json(equipmentListResponseSchema.parse(result), 200);
});

equipmentRoutes.post(
  "/",
  requireOrgAdmin,
  zValidator("json", createEquipmentSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const input = c.req.valid("json");
    const created = await equipmentService.create(db, orgId, input);

    return c.json(equipmentResponseSchema.parse(created), 201);
  },
);

equipmentRoutes.patch(
  "/:id",
  requireOrgAdmin,
  zValidator("param", equipmentIdParamSchema),
  zValidator("json", updateEquipmentSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const updated = await equipmentService.update(db, orgId, id, input);

    return c.json(equipmentResponseSchema.parse(updated), 200);
  },
);

equipmentRoutes.delete(
  "/:id",
  requireOrgAdmin,
  zValidator("param", equipmentIdParamSchema),
  async (c) => {
    const orgId = c.get("orgId")!;
    const { id } = c.req.valid("param");
    await equipmentService.delete(db, orgId, id);

    return c.body(null, 204);
  },
);
