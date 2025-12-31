import { createClient } from '@/lib/supabase/server';
import { db, profiles } from '@/db';
import { eq } from 'drizzle-orm';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { ApiKeyService } from '@/services/api-key-service';
import { NextRequest } from 'next/server';

export async function getServerSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user } : null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return profile?.isAdmin ?? false;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new AuthenticationError('Authentication required');
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  const admin = await isAdmin(session.user.id);
  if (!admin) {
    throw new AuthorizationError('Admin access required');
  }
  return session;
}

/**
 * Authenticate via API key (Bearer token) or Supabase session
 * Returns user ID and team info for authorization checks
 *
 * Priority:
 * 1. API key in Authorization header (for CLI)
 * 2. Supabase session cookie (for dashboard)
 */
export async function requireAuthOrApiKey(req: NextRequest): Promise<{
  userId: string;
  teamId: string;
  authMethod: 'api_key' | 'session';
}> {
  // Check for API key first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team || !validation.team.ownerId) {
      throw new AuthenticationError('Invalid API key');
    }

    return {
      userId: validation.team.ownerId,
      teamId: validation.team.id,
      authMethod: 'api_key',
    };
  }

  // Fall back to Supabase session
  const session = await getServerSession();
  if (!session) {
    throw new AuthenticationError('Authentication required');
  }

  // Get the user's team
  const { TeamService } = await import('@/services/team-service');
  const team = await TeamService.getByOwnerId(session.user.id);

  if (!team) {
    throw new AuthenticationError('No team found for user');
  }

  return {
    userId: session.user.id,
    teamId: team.id,
    authMethod: 'session',
  };
}
