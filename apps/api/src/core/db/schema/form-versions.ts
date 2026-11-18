import type { FormDefinition } from "@haccp/shared";
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { forms } from "./forms.js";

/** Rows are never updated: every saved definition is a new version that records point at. */
export const formVersions = pgTable(
  "form_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").$type<FormDefinition>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("form_versions_form_id_version_unique").on(
      table.formId,
      table.version,
    ),
    check("form_versions_version_positive", sql`${table.version} > 0`),
  ],
);

export type FormVersion = typeof formVersions.$inferSelect;
export type NewFormVersion = typeof formVersions.$inferInsert;
