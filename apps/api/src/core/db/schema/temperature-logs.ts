import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { taskCompletions } from "./task-completions.js";
import { equipment } from "./equipment.js";
import { locations } from "./locations.js";

export const temperatureLogs = pgTable(
  "temperature_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    taskCompletionId: uuid("task_completion_id")
      .notNull()
      .references(() => taskCompletions.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "restrict" }),
    recordedC: numeric("recorded_c", { precision: 4, scale: 1 }).notNull(),
    minTempC: numeric("min_temp_c", { precision: 4, scale: 1 }).notNull(),
    maxTempC: numeric("max_temp_c", { precision: 4, scale: 1 }).notNull(),
    result: text("result").notNull(),
    correctiveAction: text("corrective_action"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    recordedBy: text("recorded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("temperature_logs_task_completion_id_unique").on(
      table.taskCompletionId,
    ),
    index("temperature_logs_org_id_idx").on(table.orgId),
    index("temperature_logs_location_id_recorded_at_idx").on(
      table.locationId,
      table.recordedAt,
    ),
    index("temperature_logs_equipment_id_idx").on(table.equipmentId),
  ],
);

export type TemperatureLog = typeof temperatureLogs.$inferSelect;
export type NewTemperatureLog = typeof temperatureLogs.$inferInsert;
