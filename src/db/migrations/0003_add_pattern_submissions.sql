-- Pattern Submissions - AI-generated patterns submitted for admin review
CREATE TABLE IF NOT EXISTS "pattern_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

	-- Pattern details
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"base_pattern" text,
	"category" text,

	-- Why the AI submitted this
	"reason" text,
	"user_context" text,

	-- AI Analysis (generated on submission)
	"ai_summary" text,
	"ai_rating" integer,
	"ai_recommendation" text,
	"ai_analysis" text,

	-- Who submitted
	"submitted_by_team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,

	-- Review status: pending, approved, rejected
	"status" text DEFAULT 'pending',
	"admin_notes" text,
	"reviewed_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,

	-- If approved, which version it was added to
	"added_to_version" text,

	-- Timestamps
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS "pattern_submissions_status_idx" ON "pattern_submissions"("status");
CREATE INDEX IF NOT EXISTS "pattern_submissions_created_at_idx" ON "pattern_submissions"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "pattern_submissions_ai_rating_idx" ON "pattern_submissions"("ai_rating" DESC);
