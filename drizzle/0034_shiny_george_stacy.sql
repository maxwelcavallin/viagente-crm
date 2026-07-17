ALTER TABLE "instagram_channels" ALTER COLUMN "access_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "instagram_channels" ALTER COLUMN "token_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "instagram_channels" DROP COLUMN "page_id";--> statement-breakpoint
ALTER TABLE "instagram_channels" DROP COLUMN "page_access_token";