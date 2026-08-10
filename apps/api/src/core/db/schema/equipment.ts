import { sql } from "drizzle-orm";
import {
  check,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    minTempC: numeric("min_temp_c", { precision: 4, scale: 1 }).notNull(),
    maxTempC: numeric("max_temp_c", { precision: 4, scale: 1 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // No standalone location_id index: it is an exact left prefix of this
    // composite unique, which already serves every location-scoped lookup.
    uniqueIndex("equipment_location_id_name_unique").on(
      table.locationId,
      table.name,
    ),
    check(
      "equipment_min_temp_less_than_max_temp",
      sql`${table.minTempC} < ${table.maxTempC}`,
    ),
  ],
);

export type Equipment = typeof equipment.$inferSelect;
export type NewEquipment = typeof equipment.$inferInsert;
