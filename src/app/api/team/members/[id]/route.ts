import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { TeamInviteService } from '@/services/team-invite-service';
import { handleApiError, successResponse, applyRateLimit, rateLimitConfigs } from '@/lib/api-utils';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

/**
 * PATCH /api/team/members/[id]
 * Update a team member's role
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:members:write', session.user.id, rateLimitConfigs.apiWrite);

    const { id: memberId } = await params;

    if (!memberId) {
      throw new ValidationError('Member ID is required');
    }

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const body = await req.json();
    const { role } = updateRoleSchema.parse(body);

    await TeamInviteService.updateMemberRole(
      memberId,
      team.id,
      role,
      session.user.id
    );

    return successResponse({ updated: true, role });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/team/members/[id]
 * Remove a team member
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:members:write', session.user.id, rateLimitConfigs.apiWrite);

    const { id: memberId } = await params;

    if (!memberId) {
      throw new ValidationError('Member ID is required');
    }

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    await TeamInviteService.removeMember(memberId, team.id, session.user.id);

    return successResponse({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
