CREATE TYPE "public"."webhook_direction" AS ENUM('entrada', 'saida');--> statement-breakpoint
ALTER TABLE "webhook_configs" ALTER COLUMN "source_platform" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_configs" ALTER COLUMN "secret_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "direction" "webhook_direction" DEFAULT 'entrada' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "target_url" text;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "events" jsonb;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "pipeline_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD COLUMN "direction" "webhook_direction" DEFAULT 'entrada' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;