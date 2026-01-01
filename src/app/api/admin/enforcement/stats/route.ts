import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { enforcementSessions, patternDiscoveries, patternValidations } from '@/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get total sessions
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions);

    // Get active sessions (not expired, not completed)
    const [activeResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions)
      .where(
        and(
          eq(enforcementSessions.status, 'active'),
          gte(enforcementSessions.expiresAt, now)
        )
      );

    // Get completed sessions
    const [completedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions)
      .where(eq(enforcementSessions.status, 'completed'));

    // Get expired sessions
    const [expiredResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions)
      .where(eq(enforcementSessions.status, 'expired'));

    // Get sessions created today
    const [todayResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions)
      .where(gte(enforcementSessions.createdAt, oneDayAgo));

    // Get sessions created this week
    const [weekResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions)
      .where(gte(enforcementSessions.createdAt, oneWeekAgo));

    // Get total discoveries
    const [discoveriesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patternDiscoveries);

    // Get total validations
    const [validationsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patternValidations);

    // Get passed validations
    const [passedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patternValidations)
      .where(eq(patternValidations.passed, true));

    // Get failed validations
    const [failedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patternValidations)
      .where(eq(patternValidations.passed, false));

    // Calculate pass rate
    const totalValidations = validationsResult?.count || 0;
    const passedValidations = passedResult?.count || 0;
    const passRate = totalValidations > 0
      ? Math.round((passedValidations / totalValidations) * 100)
      : 0;

    // Get unique projects (by projectHash)
    const [projectsResult] = await db
      .select({ count: sql<number>`count(distinct project_hash)::int` })
      .from(enforcementSessions);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalSessions: totalResult?.count || 0,
          activeSessions: activeResult?.count || 0,
          completedSessions: completedResult?.count || 0,
          expiredSessions: expiredResult?.count || 0,
          sessionsToday: todayResult?.count || 0,
          sessionsThisWeek: weekResult?.count || 0,
          totalDiscoveries: discoveriesResult?.count || 0,
          totalValidations: totalValidations,
          passedValidations: passedValidations,
          failedValidations: failedResult?.count || 0,
          passRate,
          uniqueProjects: projectsResult?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching enforcement stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enforcement stats' },
      { status: 500 }
    );
  }
}
