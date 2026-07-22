ALTER TABLE "webhook_configs" ADD COLUMN "dynamic_tag_field" text;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "dynamic_tag_mapping" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "dynamic_tag_default_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_dynamic_tag_default_id_tags_id_fk" FOREIGN KEY ("dynamic_tag_default_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;