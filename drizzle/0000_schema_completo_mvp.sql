CREATE TYPE "public"."custom_field_entity" AS ENUM('deal', 'contact');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('texto', 'numero', 'select', 'data');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('aberto', 'ganho', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('entrada', 'saida');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('enviado', 'entregue', 'lido', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('texto', 'imagem', 'audio', 'documento', 'video');--> statement-breakpoint
CREATE TYPE "public"."stage_task_type" AS ENUM('mensagem', 'ligacao', 'agendamento', 'generica');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pendente', 'concluida');--> statement-breakpoint
CREATE TYPE "public"."temperature" AS ENUM('quente', 'morno', 'frio');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'atendente');--> statement-breakpoint
CREATE TYPE "public"."webhook_log_status" AS ENUM('sucesso', 'erro');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" "custom_field_entity" NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_tags" (
	"deal_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "deal_tags_deal_id_tag_id_pk" PRIMARY KEY("deal_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"owner_id" uuid,
	"title" text NOT NULL,
	"value" numeric(12, 2),
	"source" text,
	"status" "deal_status" DEFAULT 'aberto' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"temperature" "temperature",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
-- messages é particionada por mês (created_at). drizzle-kit não gera
-- "PARTITION BY" nativamente a partir do schema Drizzle, então o
-- "PARTITION BY RANGE" abaixo e a criação das partições foram
-- adicionados manualmente a esta migration gerada. Ao alterar
-- src/db/schema.ts para esta tabela, replique a mudança aqui também
-- (drizzle-kit vai gerar uma migration de ALTER TABLE normal, sem o
-- particionamento).
--
-- Partições cobrindo 2026-07 a 2026-09 são criadas abaixo, mais uma
-- partição DEFAULT como rede de segurança para datas fora desse
-- intervalo. Antes de 2026-10, criar a próxima partição mensal
-- (manualmente ou via job agendado) para manter o benefício de
-- performance do particionamento.
CREATE TABLE "messages" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"type" "message_type" NOT NULL,
	"content" text,
	"media_url" text,
	"status" "message_status" DEFAULT 'enviado' NOT NULL,
	"z_api_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE "messages_y2026m07" PARTITION OF "messages" FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
--> statement-breakpoint
CREATE TABLE "messages_y2026m08" PARTITION OF "messages" FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
--> statement-breakpoint
CREATE TABLE "messages_y2026m09" PARTITION OF "messages" FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
--> statement-breakpoint
CREATE TABLE "messages_default" PARTITION OF "messages" DEFAULT;
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "stage_task_type" NOT NULL,
	"message_template_id" uuid,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"stage_task_id" uuid,
	"title" text NOT NULL,
	"type" "stage_task_type" NOT NULL,
	"status" "task_status" DEFAULT 'pendente' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "temperature_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"result" "temperature" NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'atendente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_platform" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"secret_token" text NOT NULL,
	"field_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_pipeline_id" uuid,
	"default_stage_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_config_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_log_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD CONSTRAINT "stage_tasks_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD CONSTRAINT "stage_tasks_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_task_id_stage_tasks_id_fk" FOREIGN KEY ("stage_task_id") REFERENCES "public"."stage_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_default_pipeline_id_pipelines_id_fk" FOREIGN KEY ("default_pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_default_stage_id_stages_id_fk" FOREIGN KEY ("default_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_config_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."webhook_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_definitions_entity_key_idx" ON "custom_field_definitions" USING btree ("entity","key");--> statement-breakpoint
CREATE INDEX "deals_stage_id_idx" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "deals_contact_id_idx" ON "deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "messages_contact_id_created_at_idx" ON "messages" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "stage_tasks_stage_id_idx" ON "stage_tasks" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "stages_pipeline_id_idx" ON "stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tasks_deal_id_idx" ON "tasks" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "webhook_logs_webhook_config_id_idx" ON "webhook_logs" USING btree ("webhook_config_id");