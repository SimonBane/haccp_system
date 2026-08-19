import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { equipment } from "./equipment.js";
import { locations } from "./locations.js";

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    weekdays: text("weekdays").array().notNull(),
    scheduledTimes: text("scheduled_times").array().notNull(),
    equipmentId: uuid("equipment_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("task_templates_location_id_idx").on(table.locationId),
    index("task_templates_equipment_id_idx").on(table.equipmentId),
    foreignKey({
      columns: [table.equipmentId, table.locationId],
      foreignColumns: [equipment.id, equipment.locationId],
    }).onDelete("restrict"),
    unique("task_templates_id_location_id_unique").on(
      table.id,
      table.locationId,
    ),
  ],
);

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
