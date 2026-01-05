import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trialFingerprints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleApiError } from '@/lib/api-utils';
import { getClientIp, checkRateLimit, rateLimitConfigs } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const startTrialSchema = z.object({
  deviceHash: z.string().min(32).max(128),
  machineId: z.string().optional(),
  platform: z.string().optional(),
  hostname: z.string().optional(),
});

/**
 * POST /api/trial/start
 * Start a 14-day free trial based on device fingerprint
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = getClientIp(req.headers);
    checkRateLimit(`trial:start:${ip}`, { windowMs: 60 * 1000, maxRequests: 10 });

    const body = await req.json();
    const { deviceHash, machineId, platform, hostname } = startTrialSchema.parse(body);

    // Check if device already has a trial
    const existing = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.deviceHash, deviceHash),
    });

    if (existing) {
      // Check if flagged for abuse
      if (existing.flagged) {
        return NextResponse.json(
          {
            error: 'trial_not_available',
            message: 'Trial not available for this device. Please contact support.',
          },
          { status: 403 }
        );
      }

      // Calculate days remaining
      const expiresAt = existing.trialExpiresAt ? new Date(existing.trialExpiresAt) : null;
      const now = new Date();
      const daysRemaining = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Check if expired
      if (expiresAt && now > expiresAt) {
        return NextResponse.json({
          trialId: existing.id,
          stage: 'expired',
          expiresAt: existing.trialExpiresAt?.toISOString(),
          daysRemaining: 0,
          canExtend: existing.trialStage === 'anonymous',
          startedAt: existing.trialStartedAt?.toISOString(),
        });
      }

      // Return existing trial state
      return NextResponse.json({
        trialId: existing.id,
        stage: existing.trialStage,
        expiresAt: existing.trialExpiresAt?.toISOString(),
        daysRemaining,
        startedAt: existing.trialStartedAt?.toISOString(),
        ...(existing.githubUsername && { githubUsername: existing.githubUsername }),
        ...(existing.projectId && { projectId: existing.projectId }),
        ...(existing.projectName && { projectName: existing.projectName }),
      });
    }

    // Create new trial (14 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const [trial] = await db.insert(trialFingerprints).values({
      deviceHash,
      machineId: machineId || null,
      platform: platform || null,
      ipAddress: ip,
      trialStage: 'anonymous',
      trialExpiresAt: expiresAt,
    }).returning();

    return NextResponse.json({
      trialId: trial.id,
      stage: 'anonymous',
      expiresAt: trial.trialExpiresAt?.toISOString(),
      daysRemaining: 14,
      startedAt: trial.trialStartedAt?.toISOString(),
    });

  } catch (error) {
    return handleApiError(error);
  }
}
