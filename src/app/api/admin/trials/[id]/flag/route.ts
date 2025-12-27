import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { TrialService } from '@/services/trial-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const flagSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * POST /api/admin/trials/[id]/flag
 * Flag a trial for abuse
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const { reason } = flagSchema.parse(body);

    const trial = await TrialService.flag(id, reason);

    if (!trial) {
      return successResponse({ error: 'Trial not found' }, 404);
    }

    return successResponse({
      message: 'Trial flagged successfully',
      trial,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/trials/[id]/flag
 * Unflag a trial
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const trial = await TrialService.unflag(id);

    if (!trial) {
      return successResponse({ error: 'Trial not found' }, 404);
    }

    return successResponse({
      message: 'Trial unflagged successfully',
      trial,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
