CREATE TABLE "cli_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_data" text,
	"team_id" uuid,
	"project_hash" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pattern_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"request" text NOT NULL,
	"context" text,
	"handled_with" text,
	"was_successful" boolean DEFAULT true,
	"team_id" uuid,
	"status" text DEFAULT 'new',
	"admin_notes" text,
	"reviewed_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "service_keys" text;--> statement-breakpoint
ALTER TABLE "cli_analytics" ADD CONSTRAINT "cli_analytics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_gaps" ADD CONSTRAINT "pattern_gaps_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_gaps" ADD CONSTRAINT "pattern_gaps_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;