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
 * VS Code extension token payload structure
 */
interface VSCodeTokenPayload {
  token: string;
  teamId: string;
  profileId: string;
  githubId: string;
  githubUsername: string;
  email: string;
  plan: string;
  trial: { endsAt: string; daysRemaining: number } | null;
  createdAt: string;
}

/**
 * Parse VS Code extension token (base64url-encoded JSON)
 */
function parseVSCodeToken(token: string): VSCodeTokenPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const payload = JSON.parse(decoded) as VSCodeTokenPayload;

    // Validate required fields
    if (payload.token && payload.teamId && payload.profileId) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Authenticate via API key (Bearer token), VS Code token, or Supabase session
 * Returns user ID and team info for authorization checks
 *
 * Priority:
 * 1. VS Code extension token (base64url JSON starting with specific pattern)
 * 2. API key in Authorization header (for CLI - starts with cb_)
 * 3. Supabase session cookie (for dashboard)
 */
export async function requireAuthOrApiKey(req: NextRequest): Promise<{
  userId: string;
  teamId: string;
  authMethod: 'api_key' | 'session' | 'vscode_token';
  vsCodePayload?: VSCodeTokenPayload;
}> {
  // Check for Bearer token
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Check if it's a VS Code extension token (base64url-encoded JSON)
    const vsCodePayload = parseVSCodeToken(token);
    if (vsCodePayload) {
      return {
        userId: vsCodePayload.profileId,
        teamId: vsCodePayload.teamId,
        authMethod: 'vscode_token',
        vsCodePayload,
      };
    }

    // Otherwise treat as API key
    const validation = await ApiKeyService.validate(token);

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
