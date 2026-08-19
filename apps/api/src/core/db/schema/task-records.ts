import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { taskOccurrences } from "./task-occurrences.js";
import { users } from "./users.js";

export const taskRecords = pgTable(
  "task_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => taskOccurrences.id, { onDelete: "restrict" }),
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
  ],
);

export type TaskRecord = typeof taskRecords.$inferSelect;
export type NewTaskRecord = typeof taskRecords.$inferInsert;
