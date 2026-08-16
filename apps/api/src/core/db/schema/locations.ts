import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // No standalone organization_id index: it is a left prefix of the unique below.
    unique("locations_id_organization_id_unique").on(
      table.id,
      table.organizationId,
    ),
    uniqueIndex("locations_organization_id_name_unique").on(
      table.organizationId,
      table.name,
    ),
    uniqueIndex("locations_organization_id_is_default_unique")
      .on(table.organizationId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
