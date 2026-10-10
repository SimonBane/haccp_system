import type { ResolvedLimits } from "@haccp/shared";
import {
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { formVersions } from "./form-versions.js";
import { locations } from "./locations.js";
import { targets } from "./targets.js";
import { taskTemplates } from "./task-templates.js";

export const taskOccurrences = pgTable(
  "task_occurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    taskTemplateId: uuid("task_template_id").notNull(),
    occurrenceDate: date("occurrence_date").notNull(),
    scheduledTime: text("scheduled_time").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    title: text("title").notNull(),
    formVersionId: uuid("form_version_id")
      .notNull()
      .references(() => formVersions.id, { onDelete: "restrict" }),
    targetId: uuid("target_id"),
    targetName: text("target_name"),
    resolvedLimits: jsonb("resolved_limits")
      .$type<ResolvedLimits>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // NULLS NOT DISTINCT keeps one untargeted occurrence per slot; also covers taskTemplateId-only lookups.
    unique("task_occurrences_template_target_date_time_unique")
      .on(
        table.taskTemplateId,
        table.targetId,
        table.occurrenceDate,
        table.scheduledTime,
      )
      .nullsNotDistinct(),
    index("task_occurrences_location_date_time_id_idx").on(
      table.locationId,
      table.occurrenceDate,
      table.scheduledTime,
      table.id,
    ),
    foreignKey({
      columns: [table.taskTemplateId, table.locationId],
      foreignColumns: [taskTemplates.id, taskTemplates.locationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "task_occurrences_target_location_fk",
      columns: [table.targetId, table.locationId],
      foreignColumns: [targets.id, targets.locationId],
    }).onDelete("restrict"),
  ],
);

export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type NewTaskOccurrence = typeof taskOccurrences.$inferInsert;
