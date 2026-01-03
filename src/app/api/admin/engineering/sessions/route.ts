import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { EngineeringOrchestratorService } from '@/services/engineering-orchestrator-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { EngineeringPhase } from '@/lib/engineering-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/engineering/sessions
 * Get all engineering sessions for admin dashboard
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'active' | 'paused' | 'completed' | 'abandoned' | null;
    const phase = searchParams.get('phase') as EngineeringPhase | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const result = await EngineeringOrchestratorService.getAllSessions({
      status: status || undefined,
      phase: phase || undefined,
      page,
      limit,
    });

    return successResponse({
      sessions: result.sessions,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
