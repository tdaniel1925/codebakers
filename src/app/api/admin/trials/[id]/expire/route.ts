import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { TrialService } from '@/services/trial-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/trials/[id]/expire
 * Force expire a trial
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const trial = await TrialService.forceExpire(id);

    if (!trial) {
      return successResponse({ error: 'Trial not found' }, 404);
    }

    return successResponse({
      message: 'Trial expired successfully',
      trial,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
