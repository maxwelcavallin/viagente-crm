ALTER TABLE "contacts" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_name" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_phone" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_avatar_url" text;