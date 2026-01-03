import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { EngineeringOrchestratorService } from '@/services/engineering-orchestrator-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/engineering/stats
 * Get engineering session statistics
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const stats = await EngineeringOrchestratorService.getStats();

    return successResponse({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
