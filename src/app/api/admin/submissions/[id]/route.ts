import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { PatternSubmissionService } from '@/services/pattern-submission-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/submissions/[id]
 * Get a single submission with full details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const submission = await PatternSubmissionService.getById(id);

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return successResponse(submission);
  } catch (error) {
    return handleApiError(error);
  }
}
