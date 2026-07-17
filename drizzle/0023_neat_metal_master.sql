CREATE TYPE "public"."nps_channel" AS ENUM('whatsapp', 'email');--> statement-breakpoint
CREATE TABLE "nps_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"trigger_stage_id" uuid,
	"trigger_on_won" boolean DEFAULT true NOT NULL,
	"delay_days" integer DEFAULT 3 NOT NULL,
	"channel_id" uuid,
	"message_template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nps_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" "nps_channel" NOT NULL,
	"token" text NOT NULL,
	"score" integer,
	"feedback" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nps_settings" ADD CONSTRAINT "nps_settings_trigger_stage_id_stages_id_fk" FOREIGN KEY ("trigger_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_settings" ADD CONSTRAINT "nps_settings_channel_id_whatsapp_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."whatsapp_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_settings" ADD CONSTRAINT "nps_settings_message_template_id_message_templates_id_fk" FOREIGN KEY ("message_template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nps_surveys_token_idx" ON "nps_surveys" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "nps_surveys_deal_id_idx" ON "nps_surveys" USING btree ("deal_id");