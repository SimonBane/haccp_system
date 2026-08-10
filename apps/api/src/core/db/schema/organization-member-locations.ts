import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { locations } from "./locations.js";
import { organizationMemberships } from "./organization-memberships.js";
import { organizations } from "./organizations.js";

export const organizationMemberLocations = pgTable(
  "organization_member_locations",
  {
    membershipId: uuid("membership_id").notNull(),
    locationId: uuid("location_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.locationId] }),
    foreignKey({
      columns: [table.membershipId, table.organizationId],
      foreignColumns: [
        organizationMemberships.id,
        organizationMemberships.organizationId,
      ],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.locationId, table.organizationId],
      foreignColumns: [locations.id, locations.organizationId],
    }).onDelete("cascade"),
    // Postgres indexes the referenced side of a foreign key, never the
    // referencing side. Without these, every cascade from a deleted location or
    // organization has to sequential-scan this table — and the primary key
    // (membership_id, location_id) cannot help, because location_id is not a
    // usable prefix of it. Column order matches each FK so the planner can use
    // them directly.
    index("organization_member_locations_location_id_organization_id_idx").on(
      table.locationId,
      table.organizationId,
    ),
    index("organization_member_locations_organization_id_idx").on(
      table.organizationId,
    ),
  ],
);

export type OrganizationMemberLocation =
  typeof organizationMemberLocations.$inferSelect;
export type NewOrganizationMemberLocation =
  typeof organizationMemberLocations.$inferInsert;
