import type { Equipment } from "../../core/db/schema/equipment.js";
import type { EquipmentResponse } from "@haccp/shared";

export function toEquipmentResponse(row: Equipment): EquipmentResponse {
  return {
    id: row.id,
    locationId: row.locationId,
    name: row.name,
    type: row.type as EquipmentResponse["type"],
    minTempC: Number(row.minTempC),
    maxTempC: Number(row.maxTempC),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
