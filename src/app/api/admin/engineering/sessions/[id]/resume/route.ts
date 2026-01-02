import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { EngineeringOrchestratorService } from '@/services/engineering-orchestrator-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/engineering/sessions/[id]/resume
 * Resume a paused engineering session
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const result = EngineeringOrchestratorService.resumeSession(id);

    if (!result.success) {
      return successResponse({ error: result.message }, 400);
    }

    return successResponse({ message: result.message });
  } catch (error) {
    return handleApiError(error);
  }
}
