CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'square', 'paypal');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('beta', 'pro', 'team', 'agency');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"name" text DEFAULT 'Default',
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"router_content" text,
	"cursor_rules_content" text,
	"claude_md_content" text,
	"modules_content" text,
	"cursor_modules_content" text,
	"changelog" text,
	"published_by" uuid,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "module_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_name" text NOT NULL,
	"issue" text NOT NULL,
	"module_pattern" text,
	"current_pattern" text,
	"source_url" text,
	"team_id" uuid,
	"user_id" uuid,
	"status" text DEFAULT 'pending',
	"fixed_in_version" text,
	"created_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"fixed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"features" text,
	"seats" integer DEFAULT 1 NOT NULL,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer,
	"stripe_price_id" text,
	"stripe_yearly_price_id" text,
	"square_plan_id" text,
	"square_yearly_plan_id" text,
	"paypal_plan_id" text,
	"paypal_yearly_plan_id" text,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"user_id" uuid,
	"role" text DEFAULT 'member',
	"invited_at" timestamp DEFAULT now(),
	"joined_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid,
	"payment_provider" "payment_provider",
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"square_customer_id" text,
	"square_subscription_id" text,
	"paypal_subscription_id" text,
	"subscription_status" text DEFAULT 'inactive',
	"subscription_plan" "subscription_plan",
	"beta_granted_at" timestamp,
	"beta_granted_reason" text,
	"free_downloads_used" integer DEFAULT 0,
	"free_downloads_limit" integer DEFAULT 3,
	"suspended_at" timestamp,
	"suspended_reason" text,
	"seat_limit" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_published_by_profiles_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_reports" ADD CONSTRAINT "module_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_reports" ADD CONSTRAINT "module_reports_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;