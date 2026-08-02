import {
  foreignKey,
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
  ],
);

export type OrganizationMemberLocation =
  typeof organizationMemberLocations.$inferSelect;
export type NewOrganizationMemberLocation =
  typeof organizationMemberLocations.$inferInsert;
