import { numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { taskRecords } from "./task-records.js";

export const taskRecordTemperatures = pgTable("task_record_temperatures", {
  taskRecordId: uuid("task_record_id")
    .primaryKey()
    .references(() => taskRecords.id, { onDelete: "restrict" }),
  recordedC: numeric("recorded_c", { precision: 4, scale: 1 }).notNull(),
  minTempC: numeric("min_temp_c", { precision: 4, scale: 1 }).notNull(),
  maxTempC: numeric("max_temp_c", { precision: 4, scale: 1 }).notNull(),
  result: text("result").notNull(),
  correctiveAction: text("corrective_action"),
});

export type TaskRecordTemperature =
  typeof taskRecordTemperatures.$inferSelect;
export type NewTaskRecordTemperature =
  typeof taskRecordTemperatures.$inferInsert;
