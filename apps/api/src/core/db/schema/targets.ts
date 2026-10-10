import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";
import { targetTypes } from "./target-types.js";

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    targetTypeId: uuid("target_type_id")
      .notNull()
      .references(() => targetTypes.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Archived targets free their name; also serves location_id lookups as its left prefix.
    uniqueIndex("targets_location_id_name_active_unique")
      .on(table.locationId, table.name)
      .where(sql`${table.archivedAt} IS NULL`),
    unique("targets_id_location_id_unique").on(table.id, table.locationId),
    index("targets_target_type_id_idx").on(table.targetTypeId),
    foreignKey({
      columns: [table.parentId, table.locationId],
      foreignColumns: [table.id, table.locationId],
    }).onDelete("restrict"),
    check(
      "targets_parent_not_self",
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export type Target = typeof targets.$inferSelect;
export type NewTarget = typeof targets.$inferInsert;
