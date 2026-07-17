CREATE TYPE "public"."instagram_channel_status" AS ENUM('conectado', 'desconectado', 'pendente');--> statement-breakpoint
CREATE TYPE "public"."message_channel_type" AS ENUM('whatsapp', 'instagram');--> statement-breakpoint
CREATE TABLE "instagram_channel_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"username" text,
	"instagram_user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"page_access_token" text NOT NULL,
	"status" "instagram_channel_status" DEFAULT 'pendente' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_channel_id_whatsapp_channels_id_fk";
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "instagram_user_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "channel_type" "message_channel_type" DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "external_message_id" text;--> statement-breakpoint
UPDATE "messages" SET "external_message_id" = "z_api_message_id" WHERE "z_api_message_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "instagram_channel_restrictions" ADD CONSTRAINT "instagram_channel_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_channel_restrictions" ADD CONSTRAINT "instagram_channel_restrictions_channel_id_instagram_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."instagram_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_channel_restrictions_user_channel_idx" ON "instagram_channel_restrictions" USING btree ("user_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_instagram_user_id_idx" ON "contacts" USING btree ("instagram_user_id");