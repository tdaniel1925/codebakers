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
    console.log('[Auth] Attempting to parse VS Code token, length:', token?.length);
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    console.log('[Auth] Decoded token preview:', decoded?.substring(0, 100));
    const payload = JSON.parse(decoded) as VSCodeTokenPayload;

    // Validate required fields
    if (payload.token && payload.teamId && payload.profileId) {
      console.log('[Auth] VS Code token valid, teamId:', payload.teamId);
      return payload;
    }
    console.log('[Auth] VS Code token missing required fields:', { hasToken: !!payload.token, hasTeamId: !!payload.teamId, hasProfileId: !!payload.profileId });
    return null;
  } catch (e) {
    console.log('[Auth] Failed to parse VS Code token:', e instanceof Error ? e.message : 'Unknown error');
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
  // Check for Bearer token in header
  const authHeader = req.headers.get('authorization');
  console.log('[Auth] Auth header present:', !!authHeader, 'starts with Bearer:', authHeader?.startsWith('Bearer '));

  // Also check for token in query param (fallback for VS Code extension header issues)
  const queryToken = req.nextUrl.searchParams.get('token');
  console.log('[Auth] Query token present:', !!queryToken, 'length:', queryToken?.length);

  // Get token from header or query param
  let token: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
    console.log('[Auth] Using token from Authorization header');
  } else if (queryToken) {
    token = queryToken;
    console.log('[Auth] Using token from query parameter (fallback)');
  }

  if (token) {
    console.log('[Auth] Token extracted, length:', token?.length, 'preview:', token?.substring(0, 30));

    // Check if it's a VS Code extension token (base64url-encoded JSON)
    const vsCodePayload = parseVSCodeToken(token);
    if (vsCodePayload) {
      console.log('[Auth] VS Code token authenticated successfully');
      return {
        userId: vsCodePayload.profileId,
        teamId: vsCodePayload.teamId,
        authMethod: 'vscode_token',
        vsCodePayload,
      };
    }

    console.log('[Auth] Not a VS Code token, trying as API key');
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
  console.log('[Auth] No valid Bearer token, falling back to session');
  const session = await getServerSession();
  if (!session) {
    // Include debug info in error message
    let debugInfo = 'no auth';
    if (authHeader) {
      debugInfo = `header invalid (len=${authHeader.length})`;
    } else if (queryToken) {
      debugInfo = `query token invalid (len=${queryToken.length})`;
    }
    throw new AuthenticationError(`Authentication required [${debugInfo}]`);
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
