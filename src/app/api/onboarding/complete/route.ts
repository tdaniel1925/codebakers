import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { TeamService } from '@/services/team-service';
import { db, teams } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// POST - Mark onboarding as complete
export async function POST(req: NextRequest) {
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

    // Mark onboarding as complete
    await db
      .update(teams)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(teams.id, team.id));

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
