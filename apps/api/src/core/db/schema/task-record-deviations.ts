import {
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { formVersions } from "./form-versions.js";
import { locations } from "./locations.js";
import { targets } from "./targets.js";
import { taskRecords } from "./task-records.js";
import { taskTemplates } from "./task-templates.js";
import { users } from "./users.js";

/** One row per failed record, rewritten with it; a voided record keeps its row, so reports join `task_records.voided_at`. */
export const taskRecordDeviations = pgTable(
  "task_record_deviations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskRecordId: uuid("task_record_id")
      .notNull()
      .references(() => taskRecords.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    taskTemplateId: uuid("task_template_id"),
    formVersionId: uuid("form_version_id")
      .notNull()
      .references(() => formVersions.id, { onDelete: "restrict" }),
    targetId: uuid("target_id"),
    entryDate: date("entry_date").notNull(),
    failedFieldIds: text("failed_field_ids").array().notNull(),
    note: text("note"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("task_record_deviations_task_record_id_unique").on(
      table.taskRecordId,
    ),
    index("task_record_deviations_location_entry_date_idx").on(
      table.locationId,
      table.entryDate,
    ),
    index("task_record_deviations_target_entry_date_idx").on(
      table.targetId,
      table.entryDate,
    ),
    foreignKey({
      name: "task_record_deviations_template_location_fk",
      columns: [table.taskTemplateId, table.locationId],
      foreignColumns: [taskTemplates.id, taskTemplates.locationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "task_record_deviations_target_location_fk",
      columns: [table.targetId, table.locationId],
      foreignColumns: [targets.id, targets.locationId],
    }).onDelete("restrict"),
  ],
);

/** One row per corrective answer chosen; the label is the form version's wording at the time. */
export const taskRecordDeviationAnswers = pgTable(
  "task_record_deviation_answers",
  {
    deviationId: uuid("deviation_id")
      .notNull()
      .references(() => taskRecordDeviations.id, { onDelete: "cascade" }),
    answerId: text("answer_id").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deviationId, table.answerId] }),
    index("task_record_deviation_answers_answer_id_idx").on(table.answerId),
  ],
);

export type TaskRecordDeviation = typeof taskRecordDeviations.$inferSelect;
export type NewTaskRecordDeviation = typeof taskRecordDeviations.$inferInsert;
export type NewTaskRecordDeviationAnswer =
  typeof taskRecordDeviationAnswers.$inferInsert;
