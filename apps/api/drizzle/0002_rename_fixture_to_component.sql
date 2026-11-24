ALTER TABLE "targets" DROP CONSTRAINT "targets_fixture_has_parent";--> statement-breakpoint
ALTER TABLE "targets" DROP CONSTRAINT "targets_fixture_no_limits";--> statement-breakpoint
ALTER TABLE "targets" DROP CONSTRAINT "targets_kind_valid";--> statement-breakpoint
UPDATE "targets" SET "kind" = 'component' WHERE "kind" = 'fixture';--> statement-breakpoint
DROP INDEX "targets_location_id_name_scope_active_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "targets_location_id_name_scope_active_unique" ON "targets" USING btree ("location_id","name",(CASE WHEN "kind" = 'component' THEN "parent_id" ELSE "location_id" END)) WHERE "targets"."archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_component_has_parent" CHECK ("targets"."kind" <> 'component' OR "targets"."parent_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_component_no_limits" CHECK ("targets"."kind" <> 'component' OR "targets"."limits" = '{}'::jsonb);--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_kind_valid" CHECK ("targets"."kind" IN ('equipment', 'area', 'component'));