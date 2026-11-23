import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const forms = pgTable(
  "forms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    appliesTo: text("applies_to").notNull(),
    /** Staff may log it from Today whenever it happens, at any location, with the form's own limits. */
    onDemand: boolean("on_demand").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Archived forms free their name; also serves organization_id lookups as its left prefix.
    uniqueIndex("forms_organization_id_name_active_unique")
      .on(table.organizationId, table.name)
      .where(sql`${table.archivedAt} IS NULL`),
    // Same limit as FORM_NAME_MAX_LENGTH in @haccp/shared.
    check("forms_name_length", sql`char_length(${table.name}) BETWEEN 1 AND 200`),
    check(
      "forms_applies_to_valid",
      sql`${table.appliesTo} IN ('per_item', 'location')`,
    ),
  ],
);

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
