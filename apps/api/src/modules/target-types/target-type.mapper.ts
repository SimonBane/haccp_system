import type { TargetTypeResponse } from "@haccp/shared";
import type { TargetType } from "../../core/db/schema/target-types.js";

export function toTargetTypeResponse(row: TargetType): TargetTypeResponse {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as TargetTypeResponse["kind"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
