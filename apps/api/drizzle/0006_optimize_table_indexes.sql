DROP INDEX "locations_org_id_idx";--> statement-breakpoint
DROP INDEX "equipment_org_id_idx";--> statement-breakpoint
DROP INDEX "task_templates_org_id_idx";--> statement-breakpoint
DROP INDEX "task_templates_location_id_idx";--> statement-breakpoint
CREATE INDEX "equipment_org_id_location_id_idx" ON "equipment" USING btree ("org_id","location_id");--> statement-breakpoint
CREATE INDEX "task_templates_org_id_location_id_idx" ON "task_templates" USING btree ("org_id","location_id");--> statement-breakpoint
CREATE INDEX "task_templates_equipment_id_idx" ON "task_templates" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "temperature_logs_equipment_id_idx" ON "temperature_logs" USING btree ("equipment_id");