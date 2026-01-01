CREATE TYPE "public"."enforcement_session_status" AS ENUM('active', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "enforcement_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"api_key_id" uuid,
	"device_hash" text,
	"session_token" text NOT NULL,
	"project_hash" text,
	"project_name" text,
	"task" text NOT NULL,
	"planned_files" text,
	"keywords" text,
	"start_gate_passed" boolean DEFAULT true,
	"start_gate_at" timestamp DEFAULT now(),
	"end_gate_passed" boolean DEFAULT false,
	"end_gate_at" timestamp,
	"patterns_returned" text,
	"code_examples_returned" integer DEFAULT 0,
	"validation_passed" boolean,
	"validation_issues" text,
	"tests_run" boolean DEFAULT false,
	"tests_passed" boolean,
	"typescript_passed" boolean,
	"status" "enforcement_session_status" DEFAULT 'active',
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "enforcement_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "pattern_discoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"task" text NOT NULL,
	"keywords" text,
	"patterns_matched" text,
	"codebase_matches" text,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pattern_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"feature_description" text,
	"files_modified" text,
	"tests_written" text,
	"passed" boolean NOT NULL,
	"issues" text,
	"start_gate_verified" boolean,
	"tests_exist" boolean,
	"tests_pass" boolean,
	"typescript_compiles" boolean,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "enforcement_sessions" ADD CONSTRAINT "enforcement_sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enforcement_sessions" ADD CONSTRAINT "enforcement_sessions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_discoveries" ADD CONSTRAINT "pattern_discoveries_session_id_enforcement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."enforcement_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_validations" ADD CONSTRAINT "pattern_validations_session_id_enforcement_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."enforcement_sessions"("id") ON DELETE cascade ON UPDATE no action;