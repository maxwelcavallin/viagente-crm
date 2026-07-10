CREATE TYPE "public"."tag_automation_trigger" AS ENUM('tag_adicionada', 'dias_apos_tag');--> statement-breakpoint
CREATE TABLE "tag_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"trigger" "tag_automation_trigger" DEFAULT 'tag_adicionada' NOT NULL,
	"delay_days" integer,
	"title" text NOT NULL,
	"type" "stage_task_type" NOT NULL,
	"message_template_id" uuid,
	"auto_send" boolean DEFAULT false NOT NULL,
	"auto_send_channel_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_tags" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD COLUMN "trigger_delay_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tag_automation_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tag_automations" ADD CONSTRAINT "tag_automations_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_automations" ADD CONSTRAINT "tag_automations_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_automations" ADD CONSTRAINT "tag_automations_auto_send_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("auto_send_channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tag_automation_id_tag_automations_id_fk" FOREIGN KEY ("tag_automation_id") REFERENCES "public"."tag_automations"("id") ON DELETE set null ON UPDATE no action;