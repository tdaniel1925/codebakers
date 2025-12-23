CREATE TABLE "pattern_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"base_pattern" text,
	"category" text,
	"reason" text,
	"user_context" text,
	"ai_summary" text,
	"ai_rating" integer,
	"ai_recommendation" text,
	"ai_analysis" text,
	"submitted_by_team_id" uuid,
	"status" text DEFAULT 'pending',
	"admin_notes" text,
	"reviewed_by" uuid,
	"added_to_version" text,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pattern_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"api_key_id" uuid,
	"pattern_name" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "free_downloads_limit" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "free_trial_project_id" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "free_trial_project_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "pinned_pattern_version" text;--> statement-breakpoint
ALTER TABLE "pattern_submissions" ADD CONSTRAINT "pattern_submissions_submitted_by_team_id_teams_id_fk" FOREIGN KEY ("submitted_by_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_submissions" ADD CONSTRAINT "pattern_submissions_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_usage" ADD CONSTRAINT "pattern_usage_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_usage" ADD CONSTRAINT "pattern_usage_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;