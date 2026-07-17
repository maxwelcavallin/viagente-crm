ALTER TABLE "instagram_channels" ALTER COLUMN "page_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instagram_channels" ALTER COLUMN "page_access_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instagram_channels" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "instagram_channels" ADD COLUMN "token_expires_at" timestamp with time zone;