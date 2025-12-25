-- Add service_keys column for storing GitHub, Supabase, Vercel API keys
ALTER TABLE teams ADD COLUMN IF NOT EXISTS service_keys TEXT;

-- Comment for documentation
COMMENT ON COLUMN teams.service_keys IS 'JSON object storing service API keys: { github: string, supabase: string, vercel: string }';
