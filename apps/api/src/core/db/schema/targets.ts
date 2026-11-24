import type { ItemLimits } from "@haccp/shared";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    limits: jsonb("limits").$type<ItemLimits>().notNull().default({}),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Components are named per area ("Walls" in every room), the rest per location; archived targets free their name and location_id leads for lookups.
    uniqueIndex("targets_location_id_name_scope_active_unique")
      .on(
        table.locationId,
        table.name,
        sql`(CASE WHEN ${table.kind} = 'component' THEN ${table.parentId} ELSE ${table.locationId} END)`,
      )
      .where(sql`${table.archivedAt} IS NULL`),
    unique("targets_id_location_id_unique").on(table.id, table.locationId),
    foreignKey({
      columns: [table.parentId, table.locationId],
      foreignColumns: [table.id, table.locationId],
    }).onDelete("restrict"),
    // Same limit as TARGET_NAME_MAX_LENGTH in @haccp/shared.
    check(
      "targets_name_length",
      sql`char_length(${table.name}) BETWEEN 1 AND 100`,
    ),
    check(
      "targets_kind_valid",
      sql`${table.kind} IN ('equipment', 'area', 'component')`,
    ),
    check(
      "targets_component_has_parent",
      sql`${table.kind} <> 'component' OR ${table.parentId} IS NOT NULL`,
    ),
    check(
      "targets_component_no_limits",
      sql`${table.kind} <> 'component' OR ${table.limits} = '{}'::jsonb`,
    ),
    check(
      "targets_parent_not_self",
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
  ],
).enableRLS();

export type Target = typeof targets.$inferSelect;
export type NewTarget = typeof targets.$inferInsert;
