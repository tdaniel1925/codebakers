import { NextRequest } from 'next/server';
import { db } from '@/db';
import { teams, apiKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { AuthenticationError, NotFoundError } from '@/lib/errors';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface ServiceKeys {
  github?: string;
  supabase?: string;
  vercel?: string;
}

/**
 * Hash API key for lookup
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify API key and get team
 */
async function verifyApiKeyAndGetTeam(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing API key');
  }

  const apiKey = authHeader.slice(7);
  const keyHash = hashApiKey(apiKey);

  // Find the API key
  const [foundKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!foundKey || !foundKey.isActive) {
    throw new AuthenticationError('Invalid or inactive API key');
  }

  // Update last used
  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, foundKey.id));

  // Get the team
  if (!foundKey.teamId) {
    throw new NotFoundError('Team');
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, foundKey.teamId))
    .limit(1);

  if (!team) {
    throw new NotFoundError('Team');
  }

  return team;
}

/**
 * GET /api/cli/service-keys
 * Get service keys for CLI sync (requires API key auth)
 * Returns actual keys (not masked) for local storage
 */
export async function GET(req: NextRequest) {
  try {
    applyRateLimit(req, 'api:cli:service-keys', req.headers.get('authorization') || 'unknown');

    const team = await verifyApiKeyAndGetTeam(req);

    // Parse stored keys
    let keys: ServiceKeys = {};
    if (team.serviceKeys) {
      try {
        keys = JSON.parse(team.serviceKeys);
      } catch {
        keys = {};
      }
    }

    // Return actual keys for CLI to store locally
    return successResponse({
      github: keys.github || null,
      supabase: keys.supabase || null,
      vercel: keys.vercel || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
