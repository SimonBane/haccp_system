CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Sofia' NOT NULL,
	"locale" text DEFAULT 'bg' NOT NULL,
	"multiple_locations_enabled" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_unique" ON "organizations" USING btree ("clerk_org_id");
--> statement-breakpoint
DROP INDEX "locations_org_id_unique";
--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "org_id";
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "organization_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "locations_organization_id_idx" ON "locations" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "locations_organization_id_name_unique" ON "locations" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "locations_organization_id_is_default_unique" ON "locations" USING btree ("organization_id") WHERE "is_default" = true;
--> statement-breakpoint
DROP INDEX "equipment_org_id_location_id_idx";
--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "org_id";
--> statement-breakpoint
CREATE INDEX "equipment_location_id_idx" ON "equipment" USING btree ("location_id");
--> statement-breakpoint
DROP INDEX "task_templates_org_id_location_id_idx";
--> statement-breakpoint
ALTER TABLE "task_templates" DROP COLUMN "org_id";
--> statement-breakpoint
CREATE INDEX "task_templates_location_id_idx" ON "task_templates" USING btree ("location_id");
--> statement-breakpoint
DROP INDEX "task_completions_org_id_idx";
--> statement-breakpoint
ALTER TABLE "task_completions" DROP COLUMN "org_id";
--> statement-breakpoint
DROP INDEX "temperature_logs_org_id_idx";
--> statement-breakpoint
ALTER TABLE "temperature_logs" DROP COLUMN "org_id";
