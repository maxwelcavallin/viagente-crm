CREATE TYPE "public"."api_key_scope" AS ENUM('operacional', 'admin');--> statement-breakpoint
CREATE TABLE "api_write_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "scope" "api_key_scope" DEFAULT 'operacional' NOT NULL;--> statement-breakpoint
CREATE INDEX "api_write_log_api_key_id_created_at_idx" ON "api_write_log" USING btree ("api_key_id","created_at");