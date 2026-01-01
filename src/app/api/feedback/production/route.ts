import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productionFeedback, apiKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/feedback/production
 * Report production errors that can improve patterns
 *
 * Body:
 * - errorType: string (e.g., "TypeError", "NetworkError")
 * - errorMessage: string
 * - errorStack?: string
 * - errorFile?: string
 * - errorLine?: number
 * - errorFunction?: string
 * - patternUsed?: string (which pattern was in use)
 * - sessionId?: string (enforcement session ID)
 * - source?: string ("sentry", "manual", "cli", "webhook")
 * - sourceEventId?: string (external ID from Sentry etc.)
 * - impactLevel?: string ("low", "medium", "high", "critical")
 * - usersAffected?: number
 *
 * Headers:
 * - Authorization: Bearer <api_key>
 * - x-project-id?: <project_hash>
 * - x-project-name?: <project_name>
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Authenticate (optional - webhooks might not have API key)
    const authHeader = req.headers.get('authorization');
    let teamId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const keyRecord = await db.query.apiKeys.findFirst({
        where: eq(apiKeys.keyPlain, apiKey),
        with: { team: true },
      });
      if (keyRecord?.team) {
        teamId = keyRecord.team.id;
      }
    }

    const body = await req.json();
    const {
      errorType,
      errorMessage,
      errorStack,
      errorFile,
      errorLine,
      errorFunction,
      patternUsed,
      sessionId,
      source = 'manual',
      sourceEventId,
      impactLevel,
      usersAffected,
    } = body;

    if (!errorType || !errorMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: errorType, errorMessage' },
        { status: 400 }
      );
    }

    const projectHash = req.headers.get('x-project-id') || body.projectHash;
    const projectName = req.headers.get('x-project-name') || body.projectName;

    // Check for existing similar error (dedupe by file + message + pattern)
    if (teamId && errorFile && patternUsed) {
      const existing = await db.query.productionFeedback.findFirst({
        where: and(
          eq(productionFeedback.teamId, teamId),
          eq(productionFeedback.errorFile, errorFile),
          eq(productionFeedback.errorMessage, errorMessage),
          eq(productionFeedback.patternUsed, patternUsed),
          eq(productionFeedback.isResolved, false)
        ),
      });

      if (existing) {
        // Increment occurrence count
        await db.update(productionFeedback)
          .set({
            occurrenceCount: (existing.occurrenceCount || 1) + 1,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(productionFeedback.id, existing.id));

        return NextResponse.json({
          success: true,
          action: 'incremented',
          feedbackId: existing.id,
          occurrenceCount: (existing.occurrenceCount || 1) + 1,
        });
      }
    }

    // Create new feedback entry
    const [inserted] = await db.insert(productionFeedback).values({
      teamId,
      projectHash,
      projectName,
      errorType,
      errorMessage,
      errorStack,
      errorFile,
      errorLine,
      errorFunction,
      patternUsed,
      sessionId: sessionId || undefined,
      source,
      sourceEventId,
      impactLevel,
      usersAffected,
      occurrenceCount: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      action: 'created',
      feedbackId: inserted.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/feedback/production
 * Get production feedback for a project (for pattern improvement analysis)
 *
 * Query params:
 * - pattern?: string (filter by pattern)
 * - unresolved?: boolean (only show unresolved)
 * - limit?: number (default 50)
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const apiKey = authHeader.slice(7);

    const keyRecord = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPlain, apiKey),
      with: { team: true },
    });

    if (!keyRecord?.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pattern = searchParams.get('pattern');
    const unresolved = searchParams.get('unresolved') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query conditions
    const conditions = [eq(productionFeedback.teamId, keyRecord.team.id)];

    if (pattern) {
      conditions.push(eq(productionFeedback.patternUsed, pattern));
    }

    if (unresolved) {
      conditions.push(eq(productionFeedback.isResolved, false));
    }

    const feedback = await db.query.productionFeedback.findMany({
      where: and(...conditions),
      limit,
      orderBy: (f, { desc }) => [desc(f.lastSeenAt)],
    });

    // Aggregate stats
    const stats = {
      total: feedback.length,
      byPattern: {} as Record<string, number>,
      byImpact: {} as Record<string, number>,
      unresolvedCount: feedback.filter(f => !f.isResolved).length,
    };

    feedback.forEach(f => {
      if (f.patternUsed) {
        stats.byPattern[f.patternUsed] = (stats.byPattern[f.patternUsed] || 0) + (f.occurrenceCount || 1);
      }
      if (f.impactLevel) {
        stats.byImpact[f.impactLevel] = (stats.byImpact[f.impactLevel] || 0) + 1;
      }
    });

    return NextResponse.json({
      feedback: feedback.map(f => ({
        id: f.id,
        errorType: f.errorType,
        errorMessage: f.errorMessage,
        errorFile: f.errorFile,
        errorLine: f.errorLine,
        patternUsed: f.patternUsed,
        occurrenceCount: f.occurrenceCount,
        impactLevel: f.impactLevel,
        isResolved: f.isResolved,
        firstSeenAt: f.firstSeenAt,
        lastSeenAt: f.lastSeenAt,
      })),
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
