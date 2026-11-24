CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Sofia' NOT NULL,
	"locale" text DEFAULT 'bg' NOT NULL,
	"multiple_locations_enabled" boolean DEFAULT false NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"has_image" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"has_image" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"clerk_invitation_id" text,
	"invited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_id_organization_id_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_member_locations" (
	"membership_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_locations_membership_id_location_id_pk" PRIMARY KEY("membership_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "organization_member_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_id_organization_id_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "targets_id_location_id_unique" UNIQUE("id","location_id"),
	CONSTRAINT "targets_name_length" CHECK (char_length("targets"."name") BETWEEN 1 AND 100),
	CONSTRAINT "targets_kind_valid" CHECK ("targets"."kind" IN ('equipment', 'area', 'component')),
	CONSTRAINT "targets_component_has_parent" CHECK ("targets"."kind" <> 'component' OR "targets"."parent_id" IS NOT NULL),
	CONSTRAINT "targets_component_no_limits" CHECK ("targets"."kind" <> 'component' OR "targets"."limits" = '{}'::jsonb),
	CONSTRAINT "targets_parent_not_self" CHECK ("targets"."parent_id" IS NULL OR "targets"."parent_id" <> "targets"."id")
);
--> statement-breakpoint
ALTER TABLE "targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"applies_to" text NOT NULL,
	"on_demand" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forms_name_length" CHECK (char_length("forms"."name") BETWEEN 1 AND 200),
	CONSTRAINT "forms_applies_to_valid" CHECK ("forms"."applies_to" IN ('per_item', 'location'))
);
--> statement-breakpoint
ALTER TABLE "forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_versions_form_id_version_unique" UNIQUE("form_id","version"),
	CONSTRAINT "form_versions_version_positive" CHECK ("form_versions"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "form_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"weekdays" text[] NOT NULL,
	"scheduled_times" text[] NOT NULL,
	"completion_opens_before_minutes" integer DEFAULT 1440 NOT NULL,
	"completion_due_after_minutes" integer DEFAULT 0,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_templates_id_location_id_unique" UNIQUE("id","location_id"),
	CONSTRAINT "task_templates_completion_opens_before_range" CHECK ("task_templates"."completion_opens_before_minutes" >= 0 AND "task_templates"."completion_opens_before_minutes" <= 1440),
	CONSTRAINT "task_templates_completion_due_after_range" CHECK ("task_templates"."completion_due_after_minutes" IS NULL OR ("task_templates"."completion_due_after_minutes" >= 0 AND "task_templates"."completion_due_after_minutes" <= 1440))
);
--> statement-breakpoint
ALTER TABLE "task_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_template_targets" (
	"task_template_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "task_template_targets_task_template_id_target_id_pk" PRIMARY KEY("task_template_id","target_id")
);
--> statement-breakpoint
ALTER TABLE "task_template_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"task_template_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"scheduled_time" text NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
	"title" text NOT NULL,
	"form_version_id" uuid NOT NULL,
	"target_id" uuid,
	"target_name" text,
	"resolved_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_occurrences_template_target_date_time_unique" UNIQUE NULLS NOT DISTINCT("task_template_id","target_id","occurrence_date","scheduled_time"),
	CONSTRAINT "task_occurrences_id_location_id_unique" UNIQUE("id","location_id")
);
--> statement-breakpoint
ALTER TABLE "task_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"task_template_id" uuid,
	"occurrence_id" uuid,
	"title" text NOT NULL,
	"form_version_id" uuid NOT NULL,
	"target_id" uuid,
	"target_name" text,
	"resolved_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entry_date" date NOT NULL,
	"entry_time" text NOT NULL,
	"values" jsonb NOT NULL,
	"result" text NOT NULL,
	"corrective_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid,
	CONSTRAINT "task_records_template_with_occurrence" CHECK (("task_records"."occurrence_id" IS NULL) = ("task_records"."task_template_id" IS NULL)),
	CONSTRAINT "task_records_result_valid" CHECK ("task_records"."result" IN ('pass', 'fail', 'not_evaluated'))
);
--> statement-breakpoint
ALTER TABLE "task_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_record_readings" (
	"task_record_id" uuid NOT NULL,
	"field_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"target_id" uuid,
	"unit" text NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"min_value" numeric(12, 4),
	"max_value" numeric(12, 4),
	"fails" boolean NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_record_readings_task_record_id_field_id_pk" PRIMARY KEY("task_record_id","field_id")
);
--> statement-breakpoint
ALTER TABLE "task_record_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_record_deviation_answers" (
	"deviation_id" uuid NOT NULL,
	"answer_id" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "task_record_deviation_answers_deviation_id_answer_id_pk" PRIMARY KEY("deviation_id","answer_id")
);
--> statement-breakpoint
ALTER TABLE "task_record_deviation_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_record_deviations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_record_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"task_template_id" uuid,
	"form_version_id" uuid NOT NULL,
	"target_id" uuid,
	"entry_date" date NOT NULL,
	"failed_field_ids" text[] NOT NULL,
	"note" text,
	"recorded_at" timestamp with time zone NOT NULL,
	"recorded_by_user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_record_deviations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("membership_id","organization_id") REFERENCES "public"."organization_memberships"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_location_id_organization_id_locations_id_organization_id_fk" FOREIGN KEY ("location_id","organization_id") REFERENCES "public"."locations"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_parent_id_location_id_targets_id_location_id_fk" FOREIGN KEY ("parent_id","location_id") REFERENCES "public"."targets"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_targets" ADD CONSTRAINT "task_template_targets_template_location_fk" FOREIGN KEY ("task_template_id","location_id") REFERENCES "public"."task_templates"("id","location_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_targets" ADD CONSTRAINT "task_template_targets_target_location_fk" FOREIGN KEY ("target_id","location_id") REFERENCES "public"."targets"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_form_version_id_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_template_id_location_id_task_templates_id_location_id_fk" FOREIGN KEY ("task_template_id","location_id") REFERENCES "public"."task_templates"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_target_location_fk" FOREIGN KEY ("target_id","location_id") REFERENCES "public"."targets"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_form_version_id_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_template_location_fk" FOREIGN KEY ("task_template_id","location_id") REFERENCES "public"."task_templates"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_occurrence_location_fk" FOREIGN KEY ("occurrence_id","location_id") REFERENCES "public"."task_occurrences"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_target_location_fk" FOREIGN KEY ("target_id","location_id") REFERENCES "public"."targets"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_readings" ADD CONSTRAINT "task_record_readings_task_record_id_task_records_id_fk" FOREIGN KEY ("task_record_id") REFERENCES "public"."task_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_readings" ADD CONSTRAINT "task_record_readings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_readings" ADD CONSTRAINT "task_record_readings_target_location_fk" FOREIGN KEY ("target_id","location_id") REFERENCES "public"."targets"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviation_answers" ADD CONSTRAINT "task_record_deviation_answers_deviation_id_task_record_deviations_id_fk" FOREIGN KEY ("deviation_id") REFERENCES "public"."task_record_deviations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviations" ADD CONSTRAINT "task_record_deviations_task_record_id_task_records_id_fk" FOREIGN KEY ("task_record_id") REFERENCES "public"."task_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviations" ADD CONSTRAINT "task_record_deviations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviations" ADD CONSTRAINT "task_record_deviations_form_version_id_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviations" ADD CONSTRAINT "task_record_deviations_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviations" ADD CONSTRAINT "task_record_deviations_template_location_fk" FOREIGN KEY ("task_template_id","location_id") REFERENCES "public"."task_templates"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_deviations" ADD CONSTRAINT "task_record_deviations_target_location_fk" FOREIGN KEY ("target_id","location_id") REFERENCES "public"."targets"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_unique" ON "organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" USING btree ("clerk_user_id") WHERE "users"."clerk_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_org_active_created_idx" ON "organization_memberships" USING btree ("organization_id","created_at") WHERE "organization_memberships"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "organization_member_locations_location_id_organization_id_idx" ON "organization_member_locations" USING btree ("location_id","organization_id");--> statement-breakpoint
CREATE INDEX "organization_member_locations_organization_id_idx" ON "organization_member_locations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_organization_id_name_unique" ON "locations" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_organization_id_is_default_unique" ON "locations" USING btree ("organization_id") WHERE "locations"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "targets_location_id_name_scope_active_unique" ON "targets" USING btree ("location_id","name",(CASE WHEN "kind" = 'component' THEN "parent_id" ELSE "location_id" END)) WHERE "targets"."archived_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "forms_organization_id_name_active_unique" ON "forms" USING btree ("organization_id","name") WHERE "forms"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_templates_location_id_idx" ON "task_templates" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "task_templates_form_id_idx" ON "task_templates" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "task_template_targets_target_id_idx" ON "task_template_targets" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "task_occurrences_location_date_time_id_idx" ON "task_occurrences" USING btree ("location_id","occurrence_date","scheduled_time","id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_records_occurrence_id_unique" ON "task_records" USING btree ("occurrence_id");--> statement-breakpoint
CREATE INDEX "task_records_location_entry_idx" ON "task_records" USING btree ("location_id","entry_date","entry_time","id");--> statement-breakpoint
CREATE INDEX "task_record_readings_target_field_recorded_at_idx" ON "task_record_readings" USING btree ("target_id","field_id","recorded_at");--> statement-breakpoint
CREATE INDEX "task_record_deviation_answers_answer_id_idx" ON "task_record_deviation_answers" USING btree ("answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_record_deviations_task_record_id_unique" ON "task_record_deviations" USING btree ("task_record_id");--> statement-breakpoint
CREATE INDEX "task_record_deviations_location_entry_date_idx" ON "task_record_deviations" USING btree ("location_id","entry_date");--> statement-breakpoint
CREATE INDEX "task_record_deviations_target_entry_date_idx" ON "task_record_deviations" USING btree ("target_id","entry_date");