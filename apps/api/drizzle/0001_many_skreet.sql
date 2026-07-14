CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"min_temp_c" numeric(4, 1) NOT NULL,
	"max_temp_c" numeric(4, 1) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_min_temp_less_than_max_temp" CHECK ("equipment"."min_temp_c" < "equipment"."max_temp_c")
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_org_id_unique" ON "locations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "locations_org_id_idx" ON "locations" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_location_id_name_unique" ON "equipment" USING btree ("location_id","name");--> statement-breakpoint
CREATE INDEX "equipment_org_id_idx" ON "equipment" USING btree ("org_id");