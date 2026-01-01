import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { TeamService } from '@/services/team-service';
import { EnforcementService } from '@/services/enforcement-service';
import { TrialService } from '@/services/trial-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patterns/get
 * Get specific patterns by name
 * This endpoint requires an active enforcement session (from discover_patterns)
 *
 * Body: {
 *   sessionToken: string,  // Token from discover_patterns
 *   patterns: string[]     // Pattern names to fetch
 * }
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    const body = await req.json();

    // Validate required fields
    if (!body.sessionToken || typeof body.sessionToken !== 'string') {
      return NextResponse.json(
        {
          error: 'sessionToken is required. Call /api/patterns/discover first.',
          code: 'MISSING_SESSION_TOKEN',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.patterns) || body.patterns.length === 0) {
      return NextResponse.json({ error: 'patterns array is required and must not be empty' }, { status: 400 });
    }

    // Validate session exists and is active
    const session = await EnforcementService.getSessionByToken(body.sessionToken);

    if (!session) {
      return NextResponse.json(
        {
          error: 'Session not found. Call /api/patterns/discover first.',
          code: 'SESSION_NOT_FOUND',
        },
        { status: 401 }
      );
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        {
          error: 'Session expired. Call /api/patterns/discover again.',
          code: 'SESSION_EXPIRED',
        },
        { status: 401 }
      );
    }

    // Limit patterns per request
    if (body.patterns.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 patterns per request' }, { status: 400 });
    }

    // Normalize pattern names
    const patternNames = body.patterns.map((p: string) => (p.endsWith('.md') ? p : `${p}.md`));

    // Get patterns
    const patterns = await EnforcementService.getPatterns(patternNames);

    return NextResponse.json({
      success: true,
      sessionToken: body.sessionToken,
      patterns: patterns.filter((p) => p.found),
      notFound: patterns.filter((p) => !p.found).map((p) => p.name),
      found: patterns.filter((p) => p.found).length,
      requested: body.patterns.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/patterns/get?patterns=00-core,01-database
 * Alternative: Get patterns without session (for legacy support)
 * Requires API key auth
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    const patternsParam = req.nextUrl.searchParams.get('patterns');

    if (!patternsParam) {
      return NextResponse.json({ error: 'patterns query parameter is required' }, { status: 400 });
    }

    const patternNames = patternsParam.split(',').map((p) => (p.trim().endsWith('.md') ? p.trim() : `${p.trim()}.md`));

    if (patternNames.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 patterns per request' }, { status: 400 });
    }

    const patterns = await EnforcementService.getPatterns(patternNames);

    return NextResponse.json({
      success: true,
      patterns: patterns.filter((p) => p.found),
      notFound: patterns.filter((p) => !p.found).map((p) => p.name),
      found: patterns.filter((p) => p.found).length,
      requested: patternNames.length,
      warning: 'This endpoint does not enforce pattern discovery. Use POST /api/patterns/discover for enforcement.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function validateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team) {
      return {
        error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }

    const { team } = validation;
    const accessCheck = TeamService.canAccessProject(team, null);

    if (!accessCheck.allowed) {
      return {
        error: NextResponse.json(
          {
            error: accessCheck.reason,
            code: accessCheck.code,
          },
          { status: accessCheck.code === 'ACCOUNT_SUSPENDED' ? 403 : 402 }
        ),
      };
    }

    return { teamId: team.id };
  }

  const deviceHash = req.headers.get('x-device-hash');
  if (deviceHash) {
    const trial = await TrialService.getByDeviceHash(deviceHash);

    if (!trial) {
      return {
        error: NextResponse.json({ error: 'No trial found for this device' }, { status: 401 }),
      };
    }

    if (trial.trialExpiresAt && new Date(trial.trialExpiresAt) < new Date()) {
      return {
        error: NextResponse.json({ error: 'Trial expired', code: 'TRIAL_EXPIRED' }, { status: 402 }),
      };
    }

    return { deviceHash };
  }

  return {
    error: NextResponse.json({ error: 'Missing authorization' }, { status: 401 }),
  };
}
