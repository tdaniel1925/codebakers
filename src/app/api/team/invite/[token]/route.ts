import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamInviteService } from '@/services/team-invite-service';
import { handleApiError, successResponse, applyRateLimit, rateLimitConfigs } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/team/invite/[token]
 * Get invite details (for preview before accepting)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    const invite = await TeamInviteService.getInviteByToken(token);

    if (!invite) {
      return successResponse({ valid: false, error: 'Invalid invite' });
    }

    if (invite.acceptedAt) {
      return successResponse({ valid: false, error: 'Invite already used' });
    }

    if (new Date() > invite.expiresAt) {
      return successResponse({ valid: false, error: 'Invite expired' });
    }

    return successResponse({
      valid: true,
      email: invite.email,
      role: invite.role,
      teamName: invite.teamName,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/invite/[token]
 * Accept an invite
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:invite:accept', session.user.id, rateLimitConfigs.apiWrite);

    const { token } = await params;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    const result = await TeamInviteService.acceptInvite(token, session.user.id);

    return successResponse({
      accepted: true,
      teamId: result.teamId,
      teamName: result.teamName,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
