import type { RecordValues, ResolvedLimits } from "@haccp/shared";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { formVersions } from "./form-versions.js";
import { locations } from "./locations.js";
import { targets } from "./targets.js";
import { taskOccurrences } from "./task-occurrences.js";
import { taskTemplates } from "./task-templates.js";
import { users } from "./users.js";

/** A record carries its own context; a scheduled check sets the template and occurrence, an on-demand entry neither. */
export const taskRecords = pgTable(
  "task_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    taskTemplateId: uuid("task_template_id"),
    occurrenceId: uuid("occurrence_id"),
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
    entryDate: date("entry_date").notNull(),
    entryTime: text("entry_time").notNull(),
    values: jsonb("values").$type<RecordValues>().notNull(),
    result: text("result").notNull(),
    correctiveAction: text("corrective_action"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUserId: uuid("voided_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("task_records_occurrence_id_unique").on(table.occurrenceId),
    index("task_records_location_entry_idx").on(
      table.locationId,
      table.entryDate,
      table.entryTime,
      table.id,
    ),
    // Composite keys pin the template, occurrence and target to the record's location.
    foreignKey({
      name: "task_records_template_location_fk",
      columns: [table.taskTemplateId, table.locationId],
      foreignColumns: [taskTemplates.id, taskTemplates.locationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "task_records_occurrence_location_fk",
      columns: [table.occurrenceId, table.locationId],
      foreignColumns: [taskOccurrences.id, taskOccurrences.locationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "task_records_target_location_fk",
      columns: [table.targetId, table.locationId],
      foreignColumns: [targets.id, targets.locationId],
    }).onDelete("restrict"),
    check(
      "task_records_template_with_occurrence",
      sql`(${table.occurrenceId} IS NULL) = (${table.taskTemplateId} IS NULL)`,
    ),
    check(
      "task_records_result_valid",
      sql`${table.result} IN ('pass', 'fail', 'not_evaluated')`,
    ),
  ],
).enableRLS();

export type TaskRecord = typeof taskRecords.$inferSelect;
export type NewTaskRecord = typeof taskRecords.$inferInsert;
