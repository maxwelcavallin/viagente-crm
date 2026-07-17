CREATE TYPE "public"."deal_activity_action" AS ENUM('criado', 'editado', 'etapa_alterada', 'tag_adicionada', 'tag_removida', 'ganho', 'perdido', 'excluido', 'campo_alterado');--> statement-breakpoint
CREATE TYPE "public"."deal_activity_source" AS ENUM('manual', 'automacao', 'webhook');--> statement-breakpoint
CREATE TABLE "deal_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"user_id" uuid,
	"action" "deal_activity_action" NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"source" "deal_activity_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_activity_log" ADD CONSTRAINT "deal_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_activity_log_deal_id_created_at_idx" ON "deal_activity_log" USING btree ("deal_id","created_at");