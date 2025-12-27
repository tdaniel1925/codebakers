CREATE TYPE "public"."trial_stage" AS ENUM('anonymous', 'extended', 'expired', 'converted');--> statement-breakpoint
CREATE TABLE "trial_fingerprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_hash" text NOT NULL,
	"machine_id" text,
	"github_id" text,
	"github_username" text,
	"email" text,
	"ip_address" text,
	"trial_stage" "trial_stage" DEFAULT 'anonymous',
	"trial_started_at" timestamp DEFAULT now(),
	"trial_extended_at" timestamp,
	"trial_expires_at" timestamp,
	"project_id" text,
	"project_name" text,
	"converted_to_team_id" uuid,
	"converted_at" timestamp,
	"flagged" boolean DEFAULT false,
	"flag_reason" text,
	"platform" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "trial_fingerprints_device_hash_unique" UNIQUE("device_hash"),
	CONSTRAINT "trial_fingerprints_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "trial_fingerprints" ADD CONSTRAINT "trial_fingerprints_converted_to_team_id_teams_id_fk" FOREIGN KEY ("converted_to_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;