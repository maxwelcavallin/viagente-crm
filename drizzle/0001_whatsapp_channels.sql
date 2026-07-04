CREATE TYPE "public"."whatsapp_channel_status" AS ENUM('conectado', 'desconectado', 'pendente');--> statement-breakpoint
CREATE TABLE "whatsapp_channel_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"zapi_instance_id" text NOT NULL,
	"zapi_token" text NOT NULL,
	"zapi_client_token" text NOT NULL,
	"phone_number" text,
	"status" "whatsapp_channel_status" DEFAULT 'pendente' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "whatsapp_channel_restrictions" ADD CONSTRAINT "whatsapp_channel_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_channel_restrictions" ADD CONSTRAINT "whatsapp_channel_restrictions_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_channel_restrictions_user_channel_idx" ON "whatsapp_channel_restrictions" USING btree ("user_id","channel_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE set null ON UPDATE no action;