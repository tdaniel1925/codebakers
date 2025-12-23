import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { TeamInviteService } from '@/services/team-invite-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team
 * Get team info including members and pending invites
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:read', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get team members
    const members = await TeamInviteService.getTeamMembers(team.id);

    // Get pending invites
    const pendingInvites = await TeamInviteService.getPendingInvites(team.id);

    return successResponse({
      id: team.id,
      name: team.name,
      slug: team.slug,
      seatLimit: team.seatLimit,
      usedSeats: members.length,
      members,
      pendingInvites,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
