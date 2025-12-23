import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { PatternSubmissionService } from '@/services/pattern-submission-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db, moduleReports } from '@/db';
import { gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const userStats = await AdminService.getUserStats();

    // Get module report stats
    const allReports = await db.select().from(moduleReports);
    const pendingReports = allReports.filter((r) => r.status === 'pending').length;

    // Recent activity - last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentReports = await db
      .select()
      .from(moduleReports)
      .where(gte(moduleReports.createdAt, sevenDaysAgo));

    // Get pattern submission stats
    const submissionStats = await PatternSubmissionService.getStats();

    return successResponse({
      users: userStats,
      reports: {
        total: allReports.length,
        pending: pendingReports,
        recentCount: recentReports.length,
      },
      submissions: submissionStats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
