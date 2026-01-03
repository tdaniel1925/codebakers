CREATE TYPE "public"."agent_role" AS ENUM('orchestrator', 'pm', 'architect', 'engineer', 'qa', 'security', 'documentation', 'devops');--> statement-breakpoint
CREATE TYPE "public"."engineering_phase" AS ENUM('scoping', 'requirements', 'architecture', 'design_review', 'implementation', 'code_review', 'testing', 'security_review', 'documentation', 'staging', 'launch');--> statement-breakpoint
CREATE TYPE "public"."engineering_session_status" AS ENUM('active', 'paused', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."gate_status" AS ENUM('pending', 'in_progress', 'passed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "engineering_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"agent" "agent_role" NOT NULL,
	"phase" "engineering_phase" NOT NULL,
	"decision" text NOT NULL,
	"reasoning" text NOT NULL,
	"alternatives" text,
	"confidence" integer,
	"reversible" boolean DEFAULT true,
	"impact" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engineering_gate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"phase" "engineering_phase" NOT NULL,
	"previous_status" "gate_status",
	"new_status" "gate_status" NOT NULL,
	"triggered_by" text,
	"reason" text,
	"artifacts" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engineering_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"from_agent" text NOT NULL,
	"to_agent" text NOT NULL,
	"message_type" text NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engineering_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"project_hash" text NOT NULL,
	"project_name" text NOT NULL,
	"project_description" text,
	"status" "engineering_session_status" DEFAULT 'active',
	"current_phase" "engineering_phase" DEFAULT 'scoping',
	"current_agent" "agent_role" DEFAULT 'orchestrator',
	"is_running" boolean DEFAULT true,
	"scope" text,
	"stack" text,
	"gate_status" text,
	"artifacts" text,
	"dependency_graph" text,
	"last_error" text,
	"error_count" integer DEFAULT 0,
	"total_api_calls" integer DEFAULT 0,
	"total_tokens_used" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"paused_at" timestamp,
	"completed_at" timestamp,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "engineering_decisions" ADD CONSTRAINT "engineering_decisions_session_id_engineering_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."engineering_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_gate_history" ADD CONSTRAINT "engineering_gate_history_session_id_engineering_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."engineering_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_messages" ADD CONSTRAINT "engineering_messages_session_id_engineering_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."engineering_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_sessions" ADD CONSTRAINT "engineering_sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;