import type { TargetResponse } from "@haccp/shared";
import type { TargetWithTaskCountRow } from "./target.repository.js";

export function toTargetResponse({
  target,
  taskCount,
}: TargetWithTaskCountRow): TargetResponse {
  return {
    id: target.id,
    locationId: target.locationId,
    name: target.name,
    kind: target.kind as TargetResponse["kind"],
    parentId: target.parentId,
    taskCount,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  };
}
