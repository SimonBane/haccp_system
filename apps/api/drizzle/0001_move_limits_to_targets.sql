ALTER TABLE "targets" ADD COLUMN "limits" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "task_template_targets" DROP COLUMN "limit_overrides";--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_fixture_no_limits" CHECK ("targets"."kind" <> 'fixture' OR "targets"."limits" = '{}'::jsonb);