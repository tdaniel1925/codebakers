import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { enforcementSessions, patternDiscoveries, patternValidations, teams } from '@/db/schema';
import { eq, desc, sql, and, like, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(enforcementSessions.status, status as 'active' | 'completed' | 'expired' | 'failed'));
    }
    if (search) {
      conditions.push(
        or(
          like(enforcementSessions.projectName, `%${search}%`),
          like(enforcementSessions.projectHash, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(enforcementSessions)
      .where(whereClause);

    // Get sessions with related data
    const sessions = await db
      .select({
        id: enforcementSessions.id,
        teamId: enforcementSessions.teamId,
        apiKeyId: enforcementSessions.apiKeyId,
        sessionToken: enforcementSessions.sessionToken,
        projectHash: enforcementSessions.projectHash,
        projectName: enforcementSessions.projectName,
        task: enforcementSessions.task,
        status: enforcementSessions.status,
        expiresAt: enforcementSessions.expiresAt,
        endGateAt: enforcementSessions.endGateAt,
        createdAt: enforcementSessions.createdAt,
        teamName: teams.name,
      })
      .from(enforcementSessions)
      .leftJoin(teams, eq(enforcementSessions.teamId, teams.id))
      .where(whereClause)
      .orderBy(desc(enforcementSessions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get discovery and validation counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const [discoveryCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(patternDiscoveries)
          .where(eq(patternDiscoveries.sessionId, session.id));

        const [validationCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(patternValidations)
          .where(eq(patternValidations.sessionId, session.id));

        const [passedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(patternValidations)
          .where(
            and(
              eq(patternValidations.sessionId, session.id),
              eq(patternValidations.passed, true)
            )
          );

        return {
          ...session,
          taskDescription: session.task, // Map task to taskDescription for frontend
          completedAt: session.endGateAt, // Map endGateAt to completedAt for frontend
          discoveryCount: discoveryCount?.count || 0,
          validationCount: validationCount?.count || 0,
          passedCount: passedCount?.count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessionsWithCounts,
        pagination: {
          page,
          limit,
          total: countResult?.count || 0,
          totalPages: Math.ceil((countResult?.count || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching enforcement sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enforcement sessions' },
      { status: 500 }
    );
  }
}
