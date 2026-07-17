CREATE TYPE "public"."leaddelta_profile" AS ENUM('Perfil 1', 'Perfil 2', 'Sem perfil');--> statement-breakpoint
CREATE TABLE "leaddelta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leaddelta_id" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"location_normalized" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"linkedin_url" text DEFAULT '' NOT NULL,
	"workspace_name" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"funnel_stage" text DEFAULT 'Sem estágio' NOT NULL,
	"profile" "leaddelta_profile" DEFAULT 'Sem perfil' NOT NULL,
	"has_email" boolean DEFAULT false NOT NULL,
	"has_notes" boolean DEFAULT false NOT NULL,
	"has_phone" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaddelta_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaddelta_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"connections_count" integer DEFAULT 0 NOT NULL,
	"status" "webhook_log_status" NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "leaddelta_connections_leaddelta_id_idx" ON "leaddelta_connections" USING btree ("leaddelta_id");