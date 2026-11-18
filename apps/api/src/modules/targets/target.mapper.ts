import type { TargetResponse } from "@haccp/shared";
import type { TargetWithTypeRow } from "./target.repository.js";

export function toTargetResponse(row: TargetWithTypeRow): TargetResponse {
  return {
    id: row.target.id,
    locationId: row.target.locationId,
    name: row.target.name,
    targetTypeId: row.target.targetTypeId,
    targetTypeName: row.targetTypeName,
    kind: row.kind as TargetResponse["kind"],
    parentId: row.target.parentId,
    createdAt: row.target.createdAt.toISOString(),
    updatedAt: row.target.updatedAt.toISOString(),
  };
}
