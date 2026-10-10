import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const targetTypes = pgTable(
  "target_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Archived types free their name; also serves organization_id lookups as its left prefix.
    uniqueIndex("target_types_organization_id_name_active_unique")
      .on(table.organizationId, table.name)
      .where(sql`${table.archivedAt} IS NULL`),
  ],
);

export type TargetType = typeof targetTypes.$inferSelect;
export type NewTargetType = typeof targetTypes.$inferInsert;
