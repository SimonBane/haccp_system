import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { equipment } from "./equipment.js";
import { locations } from "./locations.js";

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    weekdays: text("weekdays").array().notNull(),
    scheduledTimes: text("scheduled_times").array().notNull(),
    equipmentId: uuid("equipment_id").references(() => equipment.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("task_templates_org_id_location_id_idx").on(
      table.orgId,
      table.locationId,
    ),
    index("task_templates_equipment_id_idx").on(table.equipmentId),
  ],
);

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
