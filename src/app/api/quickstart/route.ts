import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { TeamService } from '@/services/team-service';
import { ApiKeyService } from '@/services/api-key-service';
import { TRIAL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickstart
 * Returns user status for the quickstart page:
 * - For paid users: API key and subscription info
 * - For trial users: trial info (no API key needed - trial uses device fingerprint)
 *
 * Note: Trials are device-based (CLI), not email-based. The web dashboard
 * can't look up a user's trial status - it's tracked locally when they run
 * `codebakers go`. We just tell non-paid users to use the trial flow.
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
    const isPaidUser = hasActiveSubscription || isBeta;

    // Get API key only for paid users
    let apiKey: string | null = null;
    if (isPaidUser) {
      const keys = await ApiKeyService.listByTeam(team.id);
      if (keys.length === 0) {
        const result = await ApiKeyService.create(team.id, 'Default');
        apiKey = result.key;
      } else {
        const activeKey = keys.find(k => k.isActive);
        if (activeKey?.keyPlain) {
          apiKey = activeKey.keyPlain;
        } else {
          // Old key without keyPlain - delete and create new one
          for (const key of keys) {
            await ApiKeyService.delete(key.id, team.id);
          }
          const result = await ApiKeyService.create(team.id, 'Default');
          apiKey = result.key;
        }
      }
    }

    // For non-paid users, provide trial info
    // Note: Actual trial status is tracked on their device via CLI
    // We just tell them they can use the free trial
    const trial = !isPaidUser ? {
      available: true,
      daysAvailable: TRIAL.ANONYMOUS_DAYS,
      extendedDays: TRIAL.EXTENDED_DAYS,
    } : null;

    return successResponse({
      teamName: team.name,
      hasActiveSubscription,
      isBeta,
      apiKey,
      trial,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
