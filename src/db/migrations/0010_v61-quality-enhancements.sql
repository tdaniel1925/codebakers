CREATE TYPE "public"."industry_profile" AS ENUM('general', 'healthcare', 'finance', 'legal', 'ecommerce', 'education', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."strictness_level" AS ENUM('relaxed', 'standard', 'strict', 'enterprise');--> statement-breakpoint
CREATE TABLE "architecture_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"project_hash" text,
	"conflict_type" text NOT NULL,
	"conflicting_items" text NOT NULL,
	"files_involved" text,
	"recommended_item" text,
	"recommendation_reason" text,
	"is_resolved" boolean DEFAULT false,
	"resolved_with" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pattern_compliance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"compliance_score" integer NOT NULL,
	"pattern_scores" text,
	"deductions" text,
	"files_analyzed" text,
	"patterns_checked" text,
	"structural_matches" text,
	"test_quality" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "production_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"project_hash" text,
	"project_name" text,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"error_stack" text,
	"error_file" text,
	"error_line" integer,
	"error_function" text,
	"pattern_used" text,
	"session_id" uuid,
	"occurrence_count" integer DEFAULT 1,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now(),
	"source" text,
	"source_event_id" text,
	"is_resolved" boolean DEFAULT false,
	"resolution" text,
	"pattern_updated" boolean DEFAULT false,
	"resolved_at" timestamp,
	"impact_level" text,
	"users_affected" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"project_hash" text NOT NULL,
	"project_name" text,
	"stack_decisions" text,
	"naming_conventions" text,
	"architecture_patterns" text,
	"file_structure" text,
	"project_rules" text,
	"locked_dependencies" text,
	"detected_conflicts" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"industry_profile" "industry_profile" DEFAULT 'general',
	"strictness_level" "strictness_level" DEFAULT 'standard',
	"required_patterns" text,
	"banned_patterns" text,
	"custom_rules" text,
	"require_hipaa" boolean DEFAULT false,
	"require_pci" boolean DEFAULT false,
	"require_soc2" boolean DEFAULT false,
	"require_gdpr" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "team_profiles_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE "test_quality_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"overall_score" integer,
	"coverage_percent" integer,
	"lines_total" integer,
	"lines_covered" integer,
	"has_unit_tests" boolean DEFAULT false,
	"has_integration_tests" boolean DEFAULT false,
	"has_e2e_tests" boolean DEFAULT false,
	"has_happy_path" boolean DEFAULT false,
	"has_error_cases" boolean DEFAULT false,
	"has_boundary_cases" boolean DEFAULT false,
	"has_edge_cases" boolean DEFAULT false,
	"test_files" text,
	"test_count" integer DEFAULT 0,
	"missing_tests" text,
	"recommendations" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "architecture_conflicts" ADD CONSTRAINT "architecture_conflicts_session_id_enforcement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."enforcement_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_compliance" ADD CONSTRAINT "pattern_compliance_session_id_enforcement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."enforcement_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_feedback" ADD CONSTRAINT "production_feedback_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_feedback" ADD CONSTRAINT "production_feedback_session_id_enforcement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."enforcement_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memory" ADD CONSTRAINT "project_memory_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_quality_metrics" ADD CONSTRAINT "test_quality_metrics_session_id_enforcement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."enforcement_sessions"("id") ON DELETE cascade ON UPDATE no action;