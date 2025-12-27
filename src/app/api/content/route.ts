import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { ContentService } from '@/services/content-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { db } from '@/db';
import { trialFingerprints } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Check for API key first (paid users)
    const authHeader = req.headers.get('authorization');
    const trialId = req.headers.get('x-trial-id');

    // If API key provided, use traditional flow
    if (authHeader?.startsWith('Bearer ')) {
      return handleApiKeyRequest(req, authHeader.slice(7));
    }

    // If trial ID provided, use trial flow
    if (trialId) {
      return handleTrialRequest(req, trialId);
    }

    // No authentication provided
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: 'Run `codebakers go` to start a free trial, or `codebakers setup` if you have an account.',
      },
      { status: 401 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Handle requests from paid users with API keys
 */
async function handleApiKeyRequest(req: NextRequest, apiKey: string) {
  const validation = await ApiKeyService.validate(apiKey);

  if (!validation.valid || !validation.team) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { team } = validation;

  // Get project info from headers (sent by CLI)
  const projectId = req.headers.get('x-project-id');
  const projectName = req.headers.get('x-project-name') || 'Unknown Project';

  // Check access: unlimited (paid/beta) OR free trial for same project
  const accessCheck = TeamService.canAccessProject(team, projectId);

  if (!accessCheck.allowed) {
    const isSuspended = accessCheck.code === 'ACCOUNT_SUSPENDED';
    const isProjectLimit = accessCheck.code === 'TRIAL_PROJECT_LIMIT';

    return NextResponse.json(
      {
        error: accessCheck.reason,
        code: accessCheck.code,
        ...(isSuspended && { supportUrl: 'https://codebakers.dev/support' }),
        ...(isProjectLimit && {
          upgradeUrl: 'https://codebakers.dev/billing',
          lockedProject: accessCheck.lockedProjectId,
        }),
      },
      { status: isSuspended ? 403 : 402 }
    );
  }

  // Lock free trial to this project if it's a new project
  if (accessCheck.isNewProject && projectId) {
    await TeamService.setFreeTrialProject(team.id, projectId, projectName);
  }

  // Get encoded content
  const content = await ContentService.getEncodedContent();

  // Include trial info in response
  const trialStatus = TeamService.getTrialStatus(team);

  return NextResponse.json({
    ...content,
    _meta: {
      trialStatus: trialStatus.type,
      ...(trialStatus.type === 'trial_locked' && {
        projectName: trialStatus.projectName,
      }),
    },
  });
}

/**
 * Handle requests from trial users (anonymous or extended)
 */
async function handleTrialRequest(req: NextRequest, trialId: string) {
  // Find trial by ID
  const trial = await db.query.trialFingerprints.findFirst({
    where: eq(trialFingerprints.id, trialId),
  });

  if (!trial) {
    return NextResponse.json(
      {
        error: 'Invalid trial',
        message: 'Run `codebakers go` to start a new trial.',
      },
      { status: 401 }
    );
  }

  // Check if flagged for abuse
  if (trial.flagged) {
    return NextResponse.json(
      {
        error: 'Trial not available',
        message: 'Please contact support or upgrade to a paid plan.',
      },
      { status: 403 }
    );
  }

  // Check if expired
  if (trial.trialExpiresAt && new Date() > new Date(trial.trialExpiresAt)) {
    const canExtend = trial.trialStage === 'anonymous';

    return NextResponse.json(
      {
        error: 'Trial expired',
        code: 'TRIAL_EXPIRED',
        canExtend,
        message: canExtend
          ? 'Run `codebakers extend` to add 7 more days with GitHub.'
          : 'Run `codebakers billing` to upgrade to a paid plan.',
      },
      { status: 402 }
    );
  }

  // Get project info from headers
  const projectId = req.headers.get('x-project-id');
  const projectName = req.headers.get('x-project-name') || 'Unknown Project';

  // Check project lock (trial users can only use one project)
  if (trial.projectId && projectId && trial.projectId !== projectId) {
    return NextResponse.json(
      {
        error: 'Trial locked to another project',
        code: 'TRIAL_PROJECT_LIMIT',
        lockedProject: trial.projectName || trial.projectId,
        message: 'Your trial is locked to another project. Upgrade to use multiple projects.',
        upgradeUrl: 'https://codebakers.ai/billing',
      },
      { status: 402 }
    );
  }

  // Lock trial to first project used (if not already locked)
  if (!trial.projectId && projectId) {
    await db.update(trialFingerprints)
      .set({
        projectId,
        projectName,
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, trialId));
  }

  // Get encoded content
  const content = await ContentService.getEncodedContent();

  // Calculate days remaining
  const expiresAt = trial.trialExpiresAt ? new Date(trial.trialExpiresAt) : null;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return NextResponse.json({
    ...content,
    _meta: {
      trialStatus: 'trial',
      trialStage: trial.trialStage,
      daysRemaining,
      canExtend: trial.trialStage === 'anonymous',
      ...(trial.projectName && { projectName: trial.projectName }),
    },
  });
}
