CREATE TYPE "public"."sequence_run_status" AS ENUM('em_andamento', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."sequence_step_type" AS ENUM('mensagem', 'tarefa_generica', 'tag', 'mudar_etapa');--> statement-breakpoint
CREATE TYPE "public"."sequence_trigger_type" AS ENUM('etapa', 'tag', 'sem_resposta');--> statement-breakpoint
CREATE TABLE "automation_sequence_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"current_step_order" integer DEFAULT 0 NOT NULL,
	"status" "sequence_run_status" DEFAULT 'em_andamento' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_step_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automation_sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"type" "sequence_step_type" NOT NULL,
	"title" text,
	"message_template_id" uuid,
	"auto_send" boolean DEFAULT false NOT NULL,
	"auto_send_channel_id" uuid,
	"add_tag_id" uuid,
	"move_to_stage_id" uuid
);
--> statement-breakpoint
CREATE TABLE "automation_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"trigger_type" "sequence_trigger_type" NOT NULL,
	"trigger_stage_id" uuid,
	"trigger_tag_id" uuid,
	"no_response_days" integer,
	"conditions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sequence_step_id" uuid;--> statement-breakpoint
ALTER TABLE "automation_sequence_runs" ADD CONSTRAINT "automation_sequence_runs_sequence_id_automation_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."automation_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequence_runs" ADD CONSTRAINT "automation_sequence_runs_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequence_steps" ADD CONSTRAINT "automation_sequence_steps_sequence_id_automation_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."automation_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequence_steps" ADD CONSTRAINT "automation_sequence_steps_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequence_steps" ADD CONSTRAINT "automation_sequence_steps_auto_send_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("auto_send_channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequence_steps" ADD CONSTRAINT "automation_sequence_steps_add_tag_id_tags_id_fk" FOREIGN KEY ("add_tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequence_steps" ADD CONSTRAINT "automation_sequence_steps_move_to_stage_id_stages_id_fk" FOREIGN KEY ("move_to_stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequences" ADD CONSTRAINT "automation_sequences_trigger_stage_id_stages_id_fk" FOREIGN KEY ("trigger_stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sequences" ADD CONSTRAINT "automation_sequences_trigger_tag_id_tags_id_fk" FOREIGN KEY ("trigger_tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_sequence_runs_deal_id_idx" ON "automation_sequence_runs" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "automation_sequence_runs_sequence_id_idx" ON "automation_sequence_runs" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "automation_sequence_steps_sequence_id_idx" ON "automation_sequence_steps" USING btree ("sequence_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sequence_step_id_automation_sequence_steps_id_fk" FOREIGN KEY ("sequence_step_id") REFERENCES "public"."automation_sequence_steps"("id") ON DELETE set null ON UPDATE no action;