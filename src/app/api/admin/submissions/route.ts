import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { PatternSubmissionService } from '@/services/pattern-submission-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/submissions
 * List pattern submissions with optional status filter
 * Query params: status (pending|approved|rejected), limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as
      | 'pending'
      | 'approved'
      | 'rejected'
      | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get submissions
    const submissions =
      status === 'pending'
        ? await PatternSubmissionService.listPending({ limit, offset })
        : { submissions: await PatternSubmissionService.list({ status: status || undefined, limit, offset }), total: undefined };

    // Get stats
    const stats = await PatternSubmissionService.getStats();

    return successResponse({
      submissions: submissions.submissions,
      total: submissions.total,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
