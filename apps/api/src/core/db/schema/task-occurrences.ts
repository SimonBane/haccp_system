import {
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";
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
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    equipmentId: uuid("equipment_id"),
    equipmentName: text("equipment_name"),
    minTempC: numeric("min_temp_c", { precision: 4, scale: 1 }),
    maxTempC: numeric("max_temp_c", { precision: 4, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Also covers taskTemplateId-only lookups as its left prefix.
    unique("task_occurrences_template_date_time_unique").on(
      table.taskTemplateId,
      table.occurrenceDate,
      table.scheduledTime,
    ),
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
  ],
);

export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type NewTaskOccurrence = typeof taskOccurrences.$inferInsert;
