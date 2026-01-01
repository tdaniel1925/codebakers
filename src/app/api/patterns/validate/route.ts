import { NextRequest, NextResponse } from 'next/server';
import { EnforcementService } from '@/services/enforcement-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patterns/validate
 * END GATE: Must be called AFTER implementing a feature, BEFORE saying "done"
 * Validates that patterns were followed and tests pass
 *
 * Body: {
 *   sessionToken: string,        // Token from discover_patterns
 *   featureName: string,         // Name of the feature completed
 *   featureDescription?: string, // Description of what was built
 *   filesModified?: string[],    // Files that were created/modified
 *   testsWritten?: string[],     // Test files that were written
 *   testsRun?: boolean,          // Whether tests were run
 *   testsPassed?: boolean,       // Whether tests passed
 *   typescriptPassed?: boolean   // Whether TypeScript compiled
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
          error: 'sessionToken is required. You must call /api/patterns/discover first to get a session token.',
          code: 'MISSING_SESSION_TOKEN',
        },
        { status: 400 }
      );
    }

    if (!body.featureName || typeof body.featureName !== 'string') {
      return NextResponse.json({ error: 'featureName is required and must be a string' }, { status: 400 });
    }

    // Call enforcement service
    const result = await EnforcementService.validateComplete({
      sessionToken: body.sessionToken,
      featureName: body.featureName,
      featureDescription: body.featureDescription,
      filesModified: body.filesModified,
      testsWritten: body.testsWritten,
      testsRun: body.testsRun,
      testsPassed: body.testsPassed,
      typescriptPassed: body.typescriptPassed,
    });

    // Return appropriate status based on validation result
    const status = result.passed ? 200 : 400;

    return NextResponse.json(
      {
        success: result.passed,
        passed: result.passed,
        issues: result.issues,
        sessionCompleted: result.sessionCompleted,
        message: result.message,
        // Provide next steps based on result
        nextSteps: result.passed
          ? 'Feature completed successfully. You may now tell the user the work is done.'
          : 'Fix the issues above and call this endpoint again with the same sessionToken.',
      },
      { status }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/patterns/validate?sessionToken=xxx
 * Check status of an enforcement session
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    const sessionToken = req.nextUrl.searchParams.get('sessionToken');

    if (!sessionToken) {
      return NextResponse.json({ error: 'sessionToken query parameter is required' }, { status: 400 });
    }

    const session = await EnforcementService.getSessionByToken(sessionToken);

    if (!session) {
      return NextResponse.json(
        {
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionToken: session.sessionToken,
      task: session.task,
      status: session.status,
      startGatePassed: session.startGatePassed,
      endGatePassed: session.endGatePassed,
      validationPassed: session.validationPassed,
      patternsReturned: session.patternsReturned ? JSON.parse(session.patternsReturned) : [],
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isExpired: new Date(session.expiresAt) < new Date(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
