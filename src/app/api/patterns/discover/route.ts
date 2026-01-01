import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { TeamService } from '@/services/team-service';
import { EnforcementService } from '@/services/enforcement-service';
import { TrialService } from '@/services/trial-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patterns/discover
 * START GATE: Must be called BEFORE writing any code
 * Returns relevant patterns and creates an enforcement session
 *
 * Body: {
 *   task: string,         // What the AI is about to do
 *   files?: string[],     // Files AI plans to create/modify
 *   keywords?: string[],  // Keywords to search for patterns
 *   projectHash?: string, // Hash of project for context
 *   projectName?: string  // Project name for display
 * }
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    const body = await req.json();

    // Validate required fields
    if (!body.task || typeof body.task !== 'string') {
      return NextResponse.json({ error: 'task is required and must be a string' }, { status: 400 });
    }

    // Call enforcement service
    const result = await EnforcementService.discoverPatterns(
      {
        task: body.task,
        files: body.files,
        keywords: body.keywords,
        projectHash: body.projectHash,
        projectName: body.projectName,
      },
      {
        teamId: validation.teamId,
        apiKeyId: validation.apiKeyId,
        deviceHash: validation.deviceHash,
      }
    );

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      patterns: result.patterns.map((p) => ({
        name: p.name,
        relevance: p.relevance,
        content: p.content,
      })),
      coreRules: result.coreRules,
      message: result.message,
      instruction:
        'You MUST follow these patterns when implementing this task. When done, call /api/patterns/validate with the sessionToken.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function validateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  // Check for API key auth
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team) {
      return {
        error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }

    const { team, apiKeyId } = validation;

    // Check access
    const accessCheck = TeamService.canAccessProject(team, null);

    if (!accessCheck.allowed) {
      const isSuspended = accessCheck.code === 'ACCOUNT_SUSPENDED';
      return {
        error: NextResponse.json(
          {
            error: accessCheck.reason,
            code: accessCheck.code,
            ...(isSuspended
              ? { supportUrl: 'https://codebakers.ai/support' }
              : { upgradeUrl: 'https://codebakers.ai/billing' }),
          },
          { status: isSuspended ? 403 : 402 }
        ),
      };
    }

    return { teamId: team.id, apiKeyId };
  }

  // Check for device-based trial auth
  const deviceHash = req.headers.get('x-device-hash');
  if (deviceHash) {
    const trial = await TrialService.getByDeviceHash(deviceHash);

    if (!trial) {
      return {
        error: NextResponse.json(
          {
            error: 'No trial found for this device. Run "codebakers go" to start a trial.',
            code: 'NO_TRIAL',
          },
          { status: 401 }
        ),
      };
    }

    // Check if trial expired
    if (trial.trialExpiresAt && new Date(trial.trialExpiresAt) < new Date()) {
      return {
        error: NextResponse.json(
          {
            error: 'Trial has expired. Upgrade to continue using CodeBakers.',
            code: 'TRIAL_EXPIRED',
            upgradeUrl: 'https://codebakers.ai/billing',
          },
          { status: 402 }
        ),
      };
    }

    return { deviceHash };
  }

  return {
    error: NextResponse.json(
      { error: 'Missing authorization. Provide Bearer token or x-device-hash header.' },
      { status: 401 }
    ),
  };
}
