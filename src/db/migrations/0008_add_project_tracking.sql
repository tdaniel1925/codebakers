CREATE TYPE "public"."event_type" AS ENUM('project_started', 'project_completed', 'project_paused', 'project_failed', 'phase_started', 'phase_completed', 'phase_skipped', 'phase_failed', 'feature_started', 'feature_completed', 'feature_blocked', 'feature_failed', 'file_created', 'file_modified', 'file_deleted', 'test_started', 'test_passed', 'test_failed', 'approval_requested', 'approval_granted', 'approval_rejected', 'snapshot_created', 'snapshot_restored', 'ai_decision', 'ai_confidence', 'risk_flagged', 'docs_generated', 'dependency_added', 'dependency_removed');--> statement-breakpoint
CREATE TYPE "public"."feature_status" AS ENUM('pending', 'in_progress', 'completed', 'blocked', 'failed');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('discovery', 'planning', 'building', 'testing', 'completed', 'paused', 'failed');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "project_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_file" text NOT NULL,
	"source_type" text,
	"target_file" text NOT NULL,
	"target_type" text,
	"dependency_type" text,
	"import_name" text,
	"feature_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"feature_id" uuid,
	"doc_type" text NOT NULL,
	"doc_title" text NOT NULL,
	"doc_path" text,
	"content" text NOT NULL,
	"format" text DEFAULT 'markdown',
	"is_auto_generated" boolean DEFAULT true,
	"last_generated_at" timestamp DEFAULT now(),
	"source_files" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid,
	"feature_id" uuid,
	"event_type" "event_type" NOT NULL,
	"event_title" text NOT NULL,
	"event_description" text,
	"event_data" text,
	"file_path" text,
	"file_action" text,
	"lines_changed" integer,
	"ai_confidence" integer,
	"alternatives_considered" text,
	"risk_level" "risk_level",
	"risk_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"feature_description" text,
	"feature_type" text,
	"status" "feature_status" DEFAULT 'pending',
	"blocked_reason" text,
	"files_created" text,
	"files_modified" text,
	"patterns_applied" text,
	"ai_confidence" integer,
	"ai_reasoning" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"is_directory" boolean DEFAULT false,
	"line_count" integer,
	"complexity" integer,
	"parent_path" text,
	"depth" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"renamed_from" text,
	"created_by_feature_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"modified_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_number" integer NOT NULL,
	"phase_name" text NOT NULL,
	"phase_description" text,
	"status" "phase_status" DEFAULT 'pending',
	"progress" integer DEFAULT 0,
	"required_patterns" text,
	"ai_confidence" integer,
	"ai_notes" text,
	"alternatives_considered" text,
	"requires_approval" boolean DEFAULT false,
	"approved_at" timestamp,
	"approved_by" text,
	"api_calls_used" integer DEFAULT 0,
	"tokens_used" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"estimated_duration" integer,
	"actual_duration" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid,
	"feature_id" uuid,
	"resource_type" text NOT NULL,
	"api_endpoint" text,
	"api_method" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"duration_ms" integer,
	"estimated_cost_millicents" integer,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_risk_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid,
	"feature_id" uuid,
	"risk_level" "risk_level" NOT NULL,
	"risk_category" text NOT NULL,
	"risk_title" text NOT NULL,
	"risk_description" text,
	"trigger_file" text,
	"trigger_code" text,
	"trigger_reason" text,
	"ai_recommendation" text,
	"is_resolved" boolean DEFAULT false,
	"resolution" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid,
	"snapshot_name" text NOT NULL,
	"snapshot_description" text,
	"is_automatic" boolean DEFAULT false,
	"git_commit_hash" text,
	"git_branch" text,
	"project_state" text,
	"file_tree" text,
	"was_restored" boolean DEFAULT false,
	"restored_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid,
	"feature_id" uuid,
	"test_type" text NOT NULL,
	"test_command" text,
	"passed" boolean NOT NULL,
	"total_tests" integer DEFAULT 0,
	"passed_tests" integer DEFAULT 0,
	"failed_tests" integer DEFAULT 0,
	"skipped_tests" integer DEFAULT 0,
	"stdout" text,
	"stderr" text,
	"failure_details" text,
	"duration_ms" integer,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"project_hash" text NOT NULL,
	"project_name" text NOT NULL,
	"project_description" text,
	"status" "project_status" DEFAULT 'discovery',
	"current_phase_id" uuid,
	"overall_progress" integer DEFAULT 0,
	"detected_stack" text,
	"prd_content" text,
	"discovery_answers" text,
	"ai_model" text DEFAULT 'claude-sonnet',
	"patterns_used" text,
	"total_api_calls" integer DEFAULT 0,
	"total_tokens_used" integer DEFAULT 0,
	"total_files_created" integer DEFAULT 0,
	"total_files_modified" integer DEFAULT 0,
	"total_tests_run" integer DEFAULT 0,
	"total_tests_passed" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_feature_id_project_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_feature_id_project_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_feature_id_project_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_features" ADD CONSTRAINT "project_features_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_features" ADD CONSTRAINT "project_features_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_created_by_feature_id_project_features_id_fk" FOREIGN KEY ("created_by_feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_feature_id_project_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_risk_flags" ADD CONSTRAINT "project_risk_flags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_risk_flags" ADD CONSTRAINT "project_risk_flags_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_risk_flags" ADD CONSTRAINT "project_risk_flags_feature_id_project_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_runs" ADD CONSTRAINT "project_test_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_runs" ADD CONSTRAINT "project_test_runs_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_runs" ADD CONSTRAINT "project_test_runs_feature_id_project_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."project_features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;