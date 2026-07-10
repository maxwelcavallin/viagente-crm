ALTER TABLE "stage_tasks" ADD COLUMN "auto_send" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD COLUMN "auto_send_channel_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "contact_tag_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD COLUMN "deal_tag_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD CONSTRAINT "stage_tasks_auto_send_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("auto_send_channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE set null ON UPDATE no action;