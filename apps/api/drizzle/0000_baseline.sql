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
CREATE TABLE "organization_member_locations" (
	"membership_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_locations_membership_id_location_id_pk" PRIMARY KEY("membership_id","location_id")
);
--> statement-breakpoint
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
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"min_temp_c" numeric(4, 1) NOT NULL,
	"max_temp_c" numeric(4, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_id_location_id_unique" UNIQUE("id","location_id"),
	CONSTRAINT "equipment_min_temp_less_than_max_temp" CHECK ("equipment"."min_temp_c" < "equipment"."max_temp_c")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"weekdays" text[] NOT NULL,
	"scheduled_times" text[] NOT NULL,
	"equipment_id" uuid,
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
CREATE TABLE "task_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"task_template_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"scheduled_time" text NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
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
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_membership_id_organization_id_organization_memberships_id_organization_id_fk" FOREIGN KEY ("membership_id","organization_id") REFERENCES "public"."organization_memberships"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_locations" ADD CONSTRAINT "organization_member_locations_location_id_organization_id_locations_id_organization_id_fk" FOREIGN KEY ("location_id","organization_id") REFERENCES "public"."locations"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_equipment_id_location_id_equipment_id_location_id_fk" FOREIGN KEY ("equipment_id","location_id") REFERENCES "public"."equipment"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_template_id_location_id_task_templates_id_location_id_fk" FOREIGN KEY ("task_template_id","location_id") REFERENCES "public"."task_templates"("id","location_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_record_temperatures" ADD CONSTRAINT "task_record_temperatures_task_record_id_task_records_id_fk" FOREIGN KEY ("task_record_id") REFERENCES "public"."task_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_unique" ON "organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" USING btree ("clerk_user_id") WHERE "users"."clerk_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_org_active_created_idx" ON "organization_memberships" USING btree ("organization_id","created_at") WHERE "organization_memberships"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "organization_member_locations_location_id_organization_id_idx" ON "organization_member_locations" USING btree ("location_id","organization_id");--> statement-breakpoint
CREATE INDEX "organization_member_locations_organization_id_idx" ON "organization_member_locations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_organization_id_name_unique" ON "locations" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_organization_id_is_default_unique" ON "locations" USING btree ("organization_id") WHERE "locations"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_location_id_name_unique" ON "equipment" USING btree ("location_id","name");--> statement-breakpoint
CREATE INDEX "task_templates_location_id_idx" ON "task_templates" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "task_templates_equipment_id_idx" ON "task_templates" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "task_occurrences_location_date_time_id_idx" ON "task_occurrences" USING btree ("location_id","occurrence_date","scheduled_time","id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_records_occurrence_id_unique" ON "task_records" USING btree ("occurrence_id");