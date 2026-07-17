CREATE TABLE "meeting_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_event_id" text NOT NULL,
	"crm_user_id" uuid,
	"drive_file_id" text NOT NULL,
	"drive_file_url" text NOT NULL,
	"title" text NOT NULL,
	"meeting_date" timestamp with time zone NOT NULL,
	"attendee_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"transcript" text,
	"action_items" jsonb,
	"parsed_ok" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_notes_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_note_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"deal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_crm_user_id_users_id_fk" FOREIGN KEY ("crm_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes_contacts" ADD CONSTRAINT "meeting_notes_contacts_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes_contacts" ADD CONSTRAINT "meeting_notes_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes_contacts" ADD CONSTRAINT "meeting_notes_contacts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_notes_drive_file_id_idx" ON "meeting_notes" USING btree ("drive_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_notes_contacts_note_contact_idx" ON "meeting_notes_contacts" USING btree ("meeting_note_id","contact_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_contacts_contact_id_idx" ON "meeting_notes_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_contacts_deal_id_idx" ON "meeting_notes_contacts" USING btree ("deal_id");