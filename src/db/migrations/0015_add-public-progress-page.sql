ALTER TABLE "projects" ADD COLUMN "public_slug" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_public_page_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "public_page_settings" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_public_slug_unique" UNIQUE("public_slug");