import type { EquipmentResponse } from "@haccp/shared";
import { equipment } from "../../core/db/schema/equipment.js";

type EquipmentRow = typeof equipment.$inferSelect;

export function toEquipmentResponse(row: EquipmentRow): EquipmentResponse {
  return {
    id: row.id,
    orgId: row.orgId,
    locationId: row.locationId,
    name: row.name,
    type: row.type as EquipmentResponse["type"],
    minTempC: Number(row.minTempC),
    maxTempC: Number(row.maxTempC),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
