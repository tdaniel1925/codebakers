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

    // Get existing keys or create first one
    const keys = await ApiKeyService.listByTeam(team.id);
    let apiKey: string | null = null;

    if (keys.length === 0) {
      // First time - create API key
      const result = await ApiKeyService.create(team.id, 'Default');
      apiKey = result.key;
    } else {
      // Return stored full key
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

    return successResponse({
      apiKey,
      teamName: team.name,
      onboardingCompleted: !!team.onboardingCompletedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
