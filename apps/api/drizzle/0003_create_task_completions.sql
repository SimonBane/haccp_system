CREATE TABLE "task_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"task_template_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"scheduled_time" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_template_id_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_completions_template_date_time_unique" ON "task_completions" USING btree ("task_template_id","occurrence_date","scheduled_time");--> statement-breakpoint
CREATE INDEX "task_completions_org_id_idx" ON "task_completions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "task_completions_location_date_idx" ON "task_completions" USING btree ("location_id","occurrence_date");