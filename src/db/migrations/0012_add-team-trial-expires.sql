-- Add trial expiration to teams table
-- Website signup users now get 7-day trial (parity with CLI trial)
ALTER TABLE "teams" ADD COLUMN "free_trial_expires_at" timestamp;

-- Set expiration for existing teams without subscriptions (7 days from now)
-- This gives existing free users a grace period
UPDATE "teams"
SET "free_trial_expires_at" = NOW() + INTERVAL '7 days'
WHERE "subscription_status" IS NULL
  AND "beta_granted_at" IS NULL
  AND "free_trial_expires_at" IS NULL;
