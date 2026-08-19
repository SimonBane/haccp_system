CREATE TABLE "task_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"task_template_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"scheduled_time" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"equipment_id" uuid,
	"equipment_name" text,
	"min_temp_c" numeric(4, 1),
	"max_temp_c" numeric(4, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_occurrences_template_date_time_unique" UNIQUE("task_template_id","occurrence_date","scheduled_time")
);
--> statement-breakpoint
CREATE TABLE "task_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "task_record_temperatures" (
	"task_record_id" uuid PRIMARY KEY NOT NULL,
	"recorded_c" numeric(4, 1) NOT NULL,
	"min_temp_c" numeric(4, 1) NOT NULL,
	"max_temp_c" numeric(4, 1) NOT NULL,
	"result" text NOT NULL,
	"corrective_action" text
);
--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_template_id_location_id_task_templates_id_location_id_fk" FOREIGN KEY ("task_template_id","location_id") REFERENCES "public"."task_templates"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_temperatures" ADD CONSTRAINT "task_record_temperatures_task_record_id_task_records_id_fk" FOREIGN KEY ("task_record_id") REFERENCES "public"."task_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_occurrences_location_date_time_id_idx" ON "task_occurrences" USING btree ("location_id","occurrence_date","scheduled_time","id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_records_occurrence_id_unique" ON "task_records" USING btree ("occurrence_id");