CREATE TYPE "public"."scheduled_message_status" AS ENUM('pendente', 'enviada', 'cancelada', 'erro');--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"content" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "scheduled_message_status" DEFAULT 'pendente' NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD COLUMN "days_to_complete" integer;--> statement-breakpoint
ALTER TABLE "stage_tasks" ADD COLUMN "is_automatic" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_messages_contact_id_idx" ON "scheduled_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "scheduled_messages_status_scheduled_at_idx" ON "scheduled_messages" USING btree ("status","scheduled_at");