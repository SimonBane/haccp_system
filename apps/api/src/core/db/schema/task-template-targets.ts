import type { LimitOverrides } from "@haccp/shared";
import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  uuid,
} from "drizzle-orm/pg-core";
import { targets } from "./targets.js";
import { taskTemplates } from "./task-templates.js";

export const taskTemplateTargets = pgTable(
  "task_template_targets",
  {
    taskTemplateId: uuid("task_template_id").notNull(),
    targetId: uuid("target_id").notNull(),
    locationId: uuid("location_id").notNull(),
    limitOverrides: jsonb("limit_overrides")
      .$type<LimitOverrides>()
      .notNull()
      .default({}),
  },
  (table) => [
    primaryKey({ columns: [table.taskTemplateId, table.targetId] }),
    index("task_template_targets_target_id_idx").on(table.targetId),
    // Composite keys pin the template and the target to the same location.
    foreignKey({
      name: "task_template_targets_template_location_fk",
      columns: [table.taskTemplateId, table.locationId],
      foreignColumns: [taskTemplates.id, taskTemplates.locationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "task_template_targets_target_location_fk",
      columns: [table.targetId, table.locationId],
      foreignColumns: [targets.id, targets.locationId],
    }).onDelete("restrict"),
  ],
);

export type TaskTemplateTarget = typeof taskTemplateTargets.$inferSelect;
export type NewTaskTemplateTarget = typeof taskTemplateTargets.$inferInsert;
