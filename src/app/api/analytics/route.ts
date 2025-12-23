import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { AnalyticsService } from '@/services/analytics-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics
 * Returns pattern usage analytics for the authenticated user's team
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:analytics:read', session.user.id);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get usage stats
    const stats = await AnalyticsService.getUsageStats(team.id, days);

    // Get estimated time saved
    const timeSaved = await AnalyticsService.getEstimatedTimeSaved(team.id, days);

    return successResponse({
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
      stats: {
        totalFetches: stats.totalFetches,
        uniquePatterns: stats.uniquePatterns,
        estimatedTimeSaved: timeSaved,
      },
      topPatterns: stats.topPatterns,
      usageByDay: stats.usageByDay,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
