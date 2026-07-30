import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { locations } from "./locations.js";
import { organizationMemberships } from "./organization-memberships.js";

export const organizationMemberLocations = pgTable(
  "organization_member_locations",
  {
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.locationId] }),
  ],
);

export type OrganizationMemberLocation =
  typeof organizationMemberLocations.$inferSelect;
export type NewOrganizationMemberLocation =
  typeof organizationMemberLocations.$inferInsert;
