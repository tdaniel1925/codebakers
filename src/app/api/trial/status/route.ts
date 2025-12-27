import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trialFingerprints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleApiError } from '@/lib/api-utils';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trial/status?trialId=xxx
 * Check the current status of a trial
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = getClientIp(req.headers);
    checkRateLimit(`trial:status:${ip}`, { windowMs: 60 * 1000, maxRequests: 60 });

    const { searchParams } = new URL(req.url);
    const trialId = searchParams.get('trialId');

    if (!trialId) {
      return NextResponse.json(
        { error: 'Missing trialId parameter' },
        { status: 400 }
      );
    }

    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.id, trialId),
    });

    if (!trial) {
      return NextResponse.json(
        { error: 'Trial not found' },
        { status: 404 }
      );
    }

    // Check if flagged
    if (trial.flagged) {
      return NextResponse.json(
        {
          error: 'trial_not_available',
          message: 'Trial not available. Please contact support.',
        },
        { status: 403 }
      );
    }

    // Calculate days remaining
    const expiresAt = trial.trialExpiresAt ? new Date(trial.trialExpiresAt) : null;
    const now = new Date();
    const daysRemaining = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Check if expired
    const isExpired = expiresAt && now > expiresAt;
    const stage = isExpired ? 'expired' : trial.trialStage;

    return NextResponse.json({
      trialId: trial.id,
      stage,
      expiresAt: trial.trialExpiresAt?.toISOString(),
      daysRemaining: isExpired ? 0 : daysRemaining,
      startedAt: trial.trialStartedAt?.toISOString(),
      canExtend: stage === 'anonymous' || (stage === 'expired' && trial.trialStage === 'anonymous'),
      canAccessPatterns: !isExpired,
      ...(trial.githubUsername && { githubUsername: trial.githubUsername }),
      ...(trial.projectId && { projectId: trial.projectId }),
      ...(trial.projectName && { projectName: trial.projectName }),
    });

  } catch (error) {
    return handleApiError(error);
  }
}
