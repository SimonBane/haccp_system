import {
  boolean,
  foreignKey,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";
import { targets } from "./targets.js";
import { taskRecords } from "./task-records.js";

/** A typed copy of each measurement answer in `task_records.values`, rewritten with it, for trend queries. */
export const taskRecordReadings = pgTable(
  "task_record_readings",
  {
    taskRecordId: uuid("task_record_id")
      .notNull()
      .references(() => taskRecords.id, { onDelete: "cascade" }),
    fieldId: text("field_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    targetId: uuid("target_id"),
    unit: text("unit").notNull(),
    value: numeric("value", { precision: 12, scale: 4 }).notNull(),
    minValue: numeric("min_value", { precision: 12, scale: 4 }),
    maxValue: numeric("max_value", { precision: 12, scale: 4 }),
    fails: boolean("fails").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskRecordId, table.fieldId] }),
    index("task_record_readings_target_field_recorded_at_idx").on(
      table.targetId,
      table.fieldId,
      table.recordedAt,
    ),
    foreignKey({
      name: "task_record_readings_target_location_fk",
      columns: [table.targetId, table.locationId],
      foreignColumns: [targets.id, targets.locationId],
    }).onDelete("restrict"),
  ],
);

export type TaskRecordReading = typeof taskRecordReadings.$inferSelect;
export type NewTaskRecordReading = typeof taskRecordReadings.$inferInsert;
