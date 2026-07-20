CREATE TABLE "message_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"media_type" text,
	"media_file_name" text
);
--> statement-breakpoint
ALTER TABLE "message_template_items" ADD CONSTRAINT "message_template_items_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_template_items_template_id_idx" ON "message_template_items" USING btree ("template_id");--> statement-breakpoint
-- Preserva o conteúdo/anexo de cada template já existente como seu primeiro
-- (e único, até aqui) item, antes de remover essas colunas de message_templates.
-- Reaproveita o id do template como id do item: anexos já enviados pro R2
-- ficavam em `templates/${templateId}` (chave por template) e o novo esquema
-- é por item (`templates/${itemId}`) — manter o mesmo valor evita quebrar
-- anexos já existentes.
INSERT INTO "message_template_items" ("id", "template_id", "order", "content", "media_type", "media_file_name")
SELECT "id", "id", 0, coalesce("content", ''), "media_type", "media_file_name" FROM "message_templates";--> statement-breakpoint
ALTER TABLE "message_templates" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "message_templates" DROP COLUMN "variables";--> statement-breakpoint
ALTER TABLE "message_templates" DROP COLUMN "media_type";--> statement-breakpoint
ALTER TABLE "message_templates" DROP COLUMN "media_file_name";