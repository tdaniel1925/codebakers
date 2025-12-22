import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { TeamService } from '@/services/team-service';
import { ApiKeyService } from '@/services/api-key-service';

export const dynamic = 'force-dynamic';

// GET - Get onboarding data (API key and team info)
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

    // Get existing keys
    const keys = await ApiKeyService.listByTeam(team.id);
    let apiKey: string | null = null;

    if (keys.length === 0) {
      // Create first API key during onboarding
      const result = await ApiKeyService.create(team.id, 'Default');
      apiKey = result.key;
    } else {
      // User already has a key - show prefix only
      // They can see it in Settings if needed
      const activeKey = keys.find(k => k.isActive);
      if (activeKey) {
        apiKey = `${activeKey.keyPrefix}${'•'.repeat(20)}`;
      }
    }

    return successResponse({
      apiKey,
      teamName: team.name,
      onboardingCompleted: !!team.onboardingCompletedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
