import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createEquipmentSchema,
  equipmentListResponseSchema,
  equipmentResponseSchema,
  updateEquipmentSchema,
} from "@haccp/shared";
import { registerAdminCrudRoutes } from "../../core/openapi/route-factory.js";
import type { AppEnv } from "../../types.js";
import { equipmentService } from "./equipment.service.js";

export const equipmentRoutes = new OpenAPIHono<AppEnv>();

registerAdminCrudRoutes({
  router: equipmentRoutes,
  tag: "Equipment",
  schemas: {
    create: createEquipmentSchema,
    update: updateEquipmentSchema,
    list: equipmentListResponseSchema,
    item: equipmentResponseSchema,
  },
  service: equipmentService,
});
