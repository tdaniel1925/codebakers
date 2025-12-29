CREATE TYPE "public"."cli_version_status" AS ENUM('draft', 'testing', 'stable', 'deprecated', 'blocked');--> statement-breakpoint
CREATE TABLE "cli_error_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cli_version" text NOT NULL,
	"node_version" text,
	"platform" text,
	"error_type" text NOT NULL,
	"error_message" text,
	"error_stack" text,
	"command" text,
	"team_id" uuid,
	"device_hash" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cli_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"npm_tag" text DEFAULT 'latest',
	"status" "cli_version_status" DEFAULT 'draft',
	"min_node_version" text DEFAULT '18',
	"features" text,
	"changelog" text,
	"breaking_changes" text,
	"rollout_percent" integer DEFAULT 0,
	"is_auto_update_enabled" boolean DEFAULT false,
	"published_by" uuid,
	"tested_by" uuid,
	"approved_by" uuid,
	"error_count" integer DEFAULT 0,
	"last_error_at" timestamp,
	"published_at" timestamp,
	"tested_at" timestamp,
	"stable_at" timestamp,
	"deprecated_at" timestamp,
	"blocked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cli_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
ALTER TABLE "cli_error_reports" ADD CONSTRAINT "cli_error_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_versions" ADD CONSTRAINT "cli_versions_published_by_profiles_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_versions" ADD CONSTRAINT "cli_versions_tested_by_profiles_id_fk" FOREIGN KEY ("tested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_versions" ADD CONSTRAINT "cli_versions_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Seed current CLI version as stable
INSERT INTO "cli_versions" (version, npm_tag, status, min_node_version, features, is_auto_update_enabled, rollout_percent, published_at, stable_at, created_at, updated_at)
VALUES ('3.3.0', 'latest', 'stable', '18', 'Full MCP server support, auto-update patterns, error reporting', true, 100, NOW(), NOW(), NOW(), NOW())
ON CONFLICT (version) DO NOTHING;