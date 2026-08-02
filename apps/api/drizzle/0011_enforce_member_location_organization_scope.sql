ALTER TABLE "organization_member_locations" DROP CONSTRAINT "organization_member_locations_membership_id_organization_memberships_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_member_locations" DROP CONSTRAINT "organization_member_locations_location_id_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD COLUMN "organization_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_id_organization_id_unique" UNIQUE("id","organization_id");
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_id_organization_id_unique" UNIQUE("id","organization_id");
--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("membership_id","organization_id") REFERENCES "public"."organization_memberships"("id","organization_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_location_id_organization_id_locations_id_organization_id_fk" FOREIGN KEY ("location_id","organization_id") REFERENCES "public"."locations"("id","organization_id") ON DELETE cascade ON UPDATE no action;
