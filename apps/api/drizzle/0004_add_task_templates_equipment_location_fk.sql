ALTER TABLE "task_templates" DROP CONSTRAINT "task_templates_equipment_id_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_equipment_id_location_id_equipment_id_location_id_fk" FOREIGN KEY ("equipment_id","location_id") REFERENCES "public"."equipment"("id","location_id") ON DELETE restrict ON UPDATE no action;