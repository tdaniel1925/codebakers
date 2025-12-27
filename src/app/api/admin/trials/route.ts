import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { TrialService, TrialStage } from '@/services/trial-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/trials
 * List all device trials with pagination and filtering
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const stage = searchParams.get('stage') as TrialStage | null;
    const flagged = searchParams.get('flagged');
    const expiringSoon = searchParams.get('expiringSoon') === 'true';

    const result = await TrialService.getAll({
      page,
      limit,
      stage: stage || undefined,
      flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
      expiringSoon,
    });

    // Enrich trials with calculated status
    const enrichedTrials = result.trials.map((trial) => ({
      ...trial,
      status: TrialService.getTrialStatus(trial),
    }));

    return successResponse({
      trials: enrichedTrials,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
