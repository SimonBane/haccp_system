ALTER TABLE "organizations" ADD COLUMN "image_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "has_image" boolean DEFAULT false NOT NULL;
