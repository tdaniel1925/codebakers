import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { TeamInviteService } from '@/services/team-invite-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team/members
 * Get all team members
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:members:read', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const members = await TeamInviteService.getTeamMembers(team.id);

    return successResponse({
      members,
      seatLimit: team.seatLimit,
      usedSeats: members.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
