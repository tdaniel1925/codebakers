import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { TeamInviteService } from '@/services/team-invite-service';
import { EmailService } from '@/services/email-service';
import { handleApiError, successResponse, applyRateLimit, rateLimitConfigs } from '@/lib/api-utils';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { z } from 'zod';
import { db, profiles } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']).default('member'),
});

/**
 * POST /api/team/invite
 * Send a team invite
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:invite', session.user.id, rateLimitConfigs.apiWrite);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    const body = await req.json();
    const { email, role } = inviteSchema.parse(body);

    const invite = await TeamInviteService.createInvite(
      team.id,
      email,
      role,
      session.user.id
    );

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`;

    // Get inviter name for the email
    const [inviter] = await db
      .select({ name: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1);

    // Send invite email (non-blocking)
    EmailService.sendTeamInvite(
      email,
      inviteUrl,
      team.name,
      inviter?.name || undefined
    ).catch((err) => {
      console.error('Failed to send team invite email:', err);
    });

    return successResponse({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/team/invite?id=xxx
 * Revoke a pending invite
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:team:invite', session.user.id, rateLimitConfigs.apiWrite);

    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get('id');

    if (!inviteId) {
      throw new ValidationError('Invite ID is required');
    }

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    await TeamInviteService.revokeInvite(inviteId, team.id);

    return successResponse({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
