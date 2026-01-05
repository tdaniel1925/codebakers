import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { TeamService } from '@/services/team-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickstart
 * Returns user status for the quickstart page.
 * Extension-only authentication via GitHub OAuth.
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await getServerSession();

    if (!session?.user) {
      return successResponse({ error: 'Unauthorized' }, 401);
    }

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      return successResponse({ error: 'No team found' }, 404);
    }

    // Check subscription status
    const hasActiveSubscription = team.subscriptionStatus === 'active';
    const isBeta = !!team.betaGrantedAt;

    // Check trial status
    const hasTrial = team.freeTrialExpiresAt && new Date(team.freeTrialExpiresAt) > new Date();
    const trial = hasTrial && !hasActiveSubscription && !isBeta ? {
      daysRemaining: Math.ceil((new Date(team.freeTrialExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      endsAt: team.freeTrialExpiresAt,
    } : null;

    return successResponse({
      teamName: team.name,
      hasActiveSubscription,
      isBeta,
      trial,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
