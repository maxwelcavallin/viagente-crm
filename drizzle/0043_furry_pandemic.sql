ALTER TABLE "contacts" ADD COLUMN "whatsapp_lid" text;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_whatsapp_lid_idx" ON "contacts" USING btree ("whatsapp_lid");