CREATE TYPE "public"."message_delete_scope" AS ENUM('everyone', 'me');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_scope" "message_delete_scope";