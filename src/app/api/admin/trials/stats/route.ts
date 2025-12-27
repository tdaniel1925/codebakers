import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { TrialService } from '@/services/trial-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/trials/stats
 * Get trial analytics and statistics
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const stats = await TrialService.getStats();

    return successResponse({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
