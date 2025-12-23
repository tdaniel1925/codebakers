import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { PatternSubmissionService } from '@/services/pattern-submission-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/submissions/[id]/reject
 * Reject a pattern submission
 * Body: { adminNotes?: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const submission = await PatternSubmissionService.reject(
      id,
      session.user.id,
      body.adminNotes
    );

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return successResponse({
      message: 'Pattern rejected',
      submission: {
        id: submission.id,
        name: submission.name,
        status: submission.status,
        reviewedAt: submission.reviewedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
