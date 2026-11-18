import { targetDisplayName } from "@haccp/shared";
import { alias } from "drizzle-orm/pg-core";
import { targets } from "../../core/db/schema/targets.js";

/** Left-join on `targets.parentId` so a fixture can be labelled with its area. */
export const parentTargets = alias(targets, "parent_targets");

export const targetLabelColumns = {
  targetName: targets.name,
  targetKind: targets.kind,
  parentName: parentTargets.name,
};

type TargetLabelRow = {
  targetName: string;
  targetKind: string;
  parentName: string | null;
};

export function withTargetLabel<T extends TargetLabelRow>({
  targetKind,
  parentName,
  ...row
}: T): Omit<T, "targetKind" | "parentName"> {
  return {
    ...row,
    targetName: targetDisplayName(
      { name: row.targetName, kind: targetKind },
      parentName,
    ),
  };
}
