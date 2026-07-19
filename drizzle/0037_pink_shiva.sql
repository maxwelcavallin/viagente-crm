CREATE TYPE "public"."help_role_visibility" AS ENUM('todos', 'admin', 'atendente');--> statement-breakpoint
CREATE TYPE "public"."help_track" AS ENUM('primeiros_passos_admin', 'primeiros_passos_atendente', 'referencia');--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"track" "help_track" DEFAULT 'referencia' NOT NULL,
	"order" integer,
	"role_visibility" "help_role_visibility" DEFAULT 'todos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_category_id_help_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."help_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "help_articles_slug_idx" ON "help_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "help_articles_category_id_idx" ON "help_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "help_articles_track_idx" ON "help_articles" USING btree ("track");--> statement-breakpoint
CREATE UNIQUE INDEX "help_categories_slug_idx" ON "help_categories" USING btree ("slug");