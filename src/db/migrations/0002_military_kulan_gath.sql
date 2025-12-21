CREATE TABLE "enterprise_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text NOT NULL,
	"team_size" text,
	"use_case" text,
	"status" text DEFAULT 'new',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
