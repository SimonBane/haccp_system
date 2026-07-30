import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";
import { taskTemplates } from "./task-templates.js";
import { users } from "./users.js";

export const taskCompletions = pgTable(
  "task_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    taskTemplateId: uuid("task_template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrence_date").notNull(),
    scheduledTime: text("scheduled_time").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull(),
    completedByUserId: uuid("completed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex(
      "task_completions_template_date_time_unique",
    ).on(table.taskTemplateId, table.occurrenceDate, table.scheduledTime),
    index("task_completions_location_date_idx").on(
      table.locationId,
      table.occurrenceDate,
    ),
  ],
);

export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type NewTaskCompletion = typeof taskCompletions.$inferInsert;
