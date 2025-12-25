import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface ServiceKeys {
  github?: string;
  supabase?: string;
  vercel?: string;
}

/**
 * Mask a key for display (show first 4 and last 4 chars)
 */
function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length <= 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * GET /api/team/service-keys
 * Get service keys (masked for security)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:service-keys:read', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Parse stored keys
    let keys: ServiceKeys = {};
    if (team.serviceKeys) {
      try {
        keys = JSON.parse(team.serviceKeys);
      } catch {
        keys = {};
      }
    }

    // Return masked keys (for display) and whether each is configured
    return successResponse({
      github: {
        configured: !!keys.github,
        masked: maskKey(keys.github),
      },
      supabase: {
        configured: !!keys.supabase,
        masked: maskKey(keys.supabase),
      },
      vercel: {
        configured: !!keys.vercel,
        masked: maskKey(keys.vercel),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/service-keys
 * Update service keys
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:service-keys:write', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const body = await req.json();
    const { github, supabase, vercel } = body;

    // Validate - at least one key must be provided
    if (!github && !supabase && !vercel) {
      throw new ValidationError('At least one service key must be provided');
    }

    // Parse existing keys to merge (so we don't overwrite unset keys)
    let existingKeys: ServiceKeys = {};
    if (team.serviceKeys) {
      try {
        existingKeys = JSON.parse(team.serviceKeys);
      } catch {
        existingKeys = {};
      }
    }

    // Merge - only update keys that were explicitly provided
    const updatedKeys: ServiceKeys = {
      github: github !== undefined ? github : existingKeys.github,
      supabase: supabase !== undefined ? supabase : existingKeys.supabase,
      vercel: vercel !== undefined ? vercel : existingKeys.vercel,
    };

    // Remove null/empty keys
    if (!updatedKeys.github) delete updatedKeys.github;
    if (!updatedKeys.supabase) delete updatedKeys.supabase;
    if (!updatedKeys.vercel) delete updatedKeys.vercel;

    // Save to database
    await db.update(teams)
      .set({
        serviceKeys: Object.keys(updatedKeys).length > 0 ? JSON.stringify(updatedKeys) : null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    return successResponse({
      message: 'Service keys updated',
      github: { configured: !!updatedKeys.github },
      supabase: { configured: !!updatedKeys.supabase },
      vercel: { configured: !!updatedKeys.vercel },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/team/service-keys
 * Clear specific service keys
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:service-keys:write', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get('service'); // github, supabase, vercel, or 'all'

    if (!service) {
      throw new ValidationError('Service parameter required (github, supabase, vercel, or all)');
    }

    if (service === 'all') {
      // Clear all keys
      await db.update(teams)
        .set({
          serviceKeys: null,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    } else {
      // Clear specific key
      let existingKeys: ServiceKeys = {};
      if (team.serviceKeys) {
        try {
          existingKeys = JSON.parse(team.serviceKeys);
        } catch {
          existingKeys = {};
        }
      }

      delete existingKeys[service as keyof ServiceKeys];

      await db.update(teams)
        .set({
          serviceKeys: Object.keys(existingKeys).length > 0 ? JSON.stringify(existingKeys) : null,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    }

    return successResponse({ message: `Service key(s) cleared` });
  } catch (error) {
    return handleApiError(error);
  }
}
