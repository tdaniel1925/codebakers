import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db, patternGaps, profiles } from '@/db';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pattern-gaps
 * List all pattern gaps for admin review
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // Filter by status

    let query = db
      .select({
        id: patternGaps.id,
        category: patternGaps.category,
        request: patternGaps.request,
        context: patternGaps.context,
        handledWith: patternGaps.handledWith,
        wasSuccessful: patternGaps.wasSuccessful,
        status: patternGaps.status,
        adminNotes: patternGaps.adminNotes,
        createdAt: patternGaps.createdAt,
        reviewedAt: patternGaps.reviewedAt,
      })
      .from(patternGaps)
      .orderBy(desc(patternGaps.createdAt));

    const gaps = await query;

    // Filter by status if provided
    const filteredGaps = status
      ? gaps.filter((g) => g.status === status)
      : gaps;

    // Get stats
    const stats = {
      total: gaps.length,
      new: gaps.filter((g) => g.status === 'new').length,
      reviewed: gaps.filter((g) => g.status === 'reviewed').length,
      patternAdded: gaps.filter((g) => g.status === 'pattern_added').length,
      dismissed: gaps.filter((g) => g.status === 'dismissed').length,
    };

    return successResponse({
      gaps: filteredGaps,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
