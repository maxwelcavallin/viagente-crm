CREATE TABLE "user_pipeline_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_pipeline_id" uuid;--> statement-breakpoint
ALTER TABLE "user_pipeline_visibility" ADD CONSTRAINT "user_pipeline_visibility_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_pipeline_visibility" ADD CONSTRAINT "user_pipeline_visibility_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_pipeline_visibility_user_pipeline_idx" ON "user_pipeline_visibility" USING btree ("user_id","pipeline_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_pipeline_id_pipelines_id_fk" FOREIGN KEY ("default_pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;