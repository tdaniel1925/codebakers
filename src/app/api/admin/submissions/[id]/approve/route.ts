import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { PatternSubmissionService } from '@/services/pattern-submission-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/submissions/[id]/approve
 * Approve a pattern submission
 * Body: { adminNotes?: string, addedToVersion?: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const submission = await PatternSubmissionService.approve(id, session.user.id, {
      adminNotes: body.adminNotes,
      addedToVersion: body.addedToVersion,
    });

    if (!submission) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return successResponse({
      message: 'Pattern approved successfully',
      submission: {
        id: submission.id,
        name: submission.name,
        status: submission.status,
        reviewedAt: submission.reviewedAt,
        addedToVersion: submission.addedToVersion,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
