ALTER TYPE "public"."task_status" ADD VALUE 'falhou';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "error_message" text;