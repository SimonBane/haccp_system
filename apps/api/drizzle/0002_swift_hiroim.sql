DROP INDEX "locations_organization_id_idx";--> statement-breakpoint
DROP INDEX "equipment_location_id_idx";--> statement-breakpoint
CREATE INDEX "organization_memberships_org_active_created_idx" ON "organization_memberships" USING btree ("organization_id","created_at") WHERE "organization_memberships"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "organization_member_locations_location_id_organization_id_idx" ON "organization_member_locations" USING btree ("location_id","organization_id");--> statement-breakpoint
CREATE INDEX "organization_member_locations_organization_id_idx" ON "organization_member_locations" USING btree ("organization_id");