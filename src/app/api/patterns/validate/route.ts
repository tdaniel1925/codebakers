import { NextRequest, NextResponse } from 'next/server';
import { EnforcementService } from '@/services/enforcement-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { db } from '@/db';
import { patternCompliance, testQualityMetrics, projectMemory } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patterns/validate
 * END GATE: Must be called AFTER implementing a feature, BEFORE saying "done"
 * Validates that patterns were followed and tests pass
 * Returns compliance score and test quality metrics
 *
 * Body: {
 *   sessionToken: string,        // Token from discover_patterns
 *   featureName: string,         // Name of the feature completed
 *   featureDescription?: string, // Description of what was built
 *   filesModified?: string[],    // Files that were created/modified
 *   testsWritten?: string[],     // Test files that were written
 *   testsRun?: boolean,          // Whether tests were run
 *   testsPassed?: boolean,       // Whether tests passed
 *   typescriptPassed?: boolean,  // Whether TypeScript compiled
 *   testCoverage?: number,       // Test coverage percentage (0-100)
 *   stackDecisions?: object,     // Stack decisions to save to memory
 *   codeAnalysis?: {             // Client-side code analysis results
 *     hasErrorHandling?: boolean,
 *     hasLoadingStates?: boolean,
 *     hasTypeAnnotations?: boolean,
 *     hasConsoleLog?: boolean,
 *     hasAnyType?: boolean,
 *     linesOfCode?: number,
 *   }
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

    // Call enforcement service for core validation
    const result = await EnforcementService.validateComplete({
      sessionToken: body.sessionToken,
      featureName: body.featureName,
      featureDescription: body.featureDescription,
      filesModified: body.filesModified,
      testsWritten: body.testsWritten,
      testsRun: body.testsRun,
      testsPassed: body.testsPassed,
      typescriptPassed: body.typescriptPassed,
      // Safety system integration
      safetySessionId: body.safetySessionId,
      contextWasLoaded: body.contextWasLoaded,
      intentWasClarified: body.intentWasClarified,
      scopeWasLocked: body.scopeWasLocked,
      approach: body.approach,
    });

    // Get session for additional processing
    const session = await EnforcementService.getSessionByToken(body.sessionToken);

    // Calculate compliance score
    const complianceResult = calculateComplianceScore({
      testsRun: body.testsRun,
      testsPassed: body.testsPassed,
      typescriptPassed: body.typescriptPassed,
      codeAnalysis: body.codeAnalysis,
      testsWritten: body.testsWritten,
      filesModified: body.filesModified,
    });

    // Calculate test quality metrics
    const testQuality = calculateTestQuality({
      testsWritten: body.testsWritten,
      testsPassed: body.testsPassed,
      testCoverage: body.testCoverage,
    });

    // Store compliance and test quality in database
    if (session) {
      try {
        // Store compliance
        await db.insert(patternCompliance).values({
          sessionId: session.id,
          complianceScore: complianceResult.score,
          patternScores: JSON.stringify(complianceResult.patternScores),
          deductions: JSON.stringify(complianceResult.deductions),
          filesAnalyzed: JSON.stringify(body.filesModified || []),
          patternsChecked: session.patternsReturned || '[]',
          testQuality: JSON.stringify(testQuality),
        });

        // Store test quality metrics
        await db.insert(testQualityMetrics).values({
          sessionId: session.id,
          overallScore: testQuality.overallScore,
          coveragePercent: body.testCoverage || 0,
          hasUnitTests: testQuality.hasUnitTests,
          hasIntegrationTests: testQuality.hasIntegrationTests,
          hasE2eTests: testQuality.hasE2eTests,
          hasHappyPath: testQuality.hasHappyPath,
          hasErrorCases: testQuality.hasErrorCases,
          hasBoundaryCases: testQuality.hasBoundaryCases,
          hasEdgeCases: testQuality.hasEdgeCases,
          testFiles: JSON.stringify(body.testsWritten || []),
          testCount: (body.testsWritten || []).length,
          missingTests: JSON.stringify(testQuality.missingTests),
          recommendations: JSON.stringify(testQuality.recommendations),
        });

        // Update project memory with stack decisions if provided
        if (body.stackDecisions && session.projectHash) {
          const teamId = session.teamId;
          if (teamId) {
            const existing = await db.query.projectMemory.findFirst({
              where: and(
                eq(projectMemory.teamId, teamId),
                eq(projectMemory.projectHash, session.projectHash)
              ),
            });

            if (existing) {
              const currentStack = JSON.parse(existing.stackDecisions || '{}');
              await db.update(projectMemory)
                .set({
                  stackDecisions: JSON.stringify({ ...currentStack, ...body.stackDecisions }),
                  updatedAt: new Date(),
                })
                .where(eq(projectMemory.id, existing.id));
            } else {
              await db.insert(projectMemory).values({
                teamId,
                projectHash: session.projectHash,
                projectName: session.projectName || 'Unknown Project',
                stackDecisions: JSON.stringify(body.stackDecisions),
              });
            }
          }
        }
      } catch (err) {
        // Log but don't fail validation
        console.error('Error storing compliance/quality metrics:', err);
      }
    }

    // Return appropriate status based on validation result
    const status = result.passed ? 200 : 400;

    return NextResponse.json(
      {
        success: result.passed,
        passed: result.passed,
        issues: result.issues,
        sessionCompleted: result.sessionCompleted,
        message: result.message,

        // v6.1 enhancements
        compliance: {
          score: complianceResult.score,
          deductions: complianceResult.deductions,
          patternScores: complianceResult.patternScores,
        },
        testQuality: {
          overallScore: testQuality.overallScore,
          coverage: body.testCoverage || 0,
          hasHappyPath: testQuality.hasHappyPath,
          hasErrorCases: testQuality.hasErrorCases,
          hasBoundaryCases: testQuality.hasBoundaryCases,
          missingTests: testQuality.missingTests,
          recommendations: testQuality.recommendations,
        },

        // v6.2 safety system integration
        safety: {
          score: result.safetyScore,
          gatesFollowed: result.safetyGatesFollowed,
          gatesSkipped: result.safetyGatesSkipped,
          attemptLogged: result.attemptLogged,
          decisionLogged: result.decisionLogged,
        },

        // Provide next steps based on result
        nextSteps: result.passed
          ? complianceResult.score >= 90
            ? 'Excellent work! Feature completed with high compliance score.'
            : `Feature completed. Compliance score: ${complianceResult.score}/100. ${complianceResult.deductions.length > 0 ? 'Consider addressing: ' + complianceResult.deductions.map(d => d.issue).join(', ') : ''}`
          : 'Fix the issues above and call this endpoint again with the same sessionToken.',
      },
      { status }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Calculate compliance score based on patterns followed
 */
function calculateComplianceScore(params: {
  testsRun?: boolean;
  testsPassed?: boolean;
  typescriptPassed?: boolean;
  codeAnalysis?: {
    hasErrorHandling?: boolean;
    hasLoadingStates?: boolean;
    hasTypeAnnotations?: boolean;
    hasConsoleLog?: boolean;
    hasAnyType?: boolean;
    linesOfCode?: number;
  };
  testsWritten?: string[];
  filesModified?: string[];
}): {
  score: number;
  deductions: Array<{ rule: string; issue: string; points: number }>;
  patternScores: Record<string, number>;
} {
  let score = 100;
  const deductions: Array<{ rule: string; issue: string; points: number }> = [];
  const patternScores: Record<string, number> = {};

  // Tests run check (-20 points)
  if (!params.testsRun) {
    score -= 20;
    deductions.push({ rule: 'tests-run', issue: 'Tests were not run', points: 20 });
    patternScores['testing'] = 0;
  } else if (!params.testsPassed) {
    score -= 15;
    deductions.push({ rule: 'tests-passed', issue: 'Tests did not pass', points: 15 });
    patternScores['testing'] = 50;
  } else {
    patternScores['testing'] = 100;
  }

  // TypeScript check (-15 points)
  if (!params.typescriptPassed) {
    score -= 15;
    deductions.push({ rule: 'typescript', issue: 'TypeScript errors present', points: 15 });
    patternScores['typescript'] = 0;
  } else {
    patternScores['typescript'] = 100;
  }

  // Code analysis checks
  if (params.codeAnalysis) {
    const analysis = params.codeAnalysis;

    // Error handling (-10 points if missing)
    if (analysis.hasErrorHandling === false) {
      score -= 10;
      deductions.push({ rule: 'error-handling', issue: 'Missing error handling', points: 10 });
      patternScores['error-handling'] = 0;
    } else {
      patternScores['error-handling'] = 100;
    }

    // Loading states (-5 points if missing)
    if (analysis.hasLoadingStates === false) {
      score -= 5;
      deductions.push({ rule: 'loading-states', issue: 'Missing loading states', points: 5 });
      patternScores['loading-states'] = 0;
    } else {
      patternScores['loading-states'] = 100;
    }

    // Console.log presence (-5 points)
    if (analysis.hasConsoleLog === true) {
      score -= 5;
      deductions.push({ rule: 'no-console-log', issue: 'console.log statements present', points: 5 });
      patternScores['clean-code'] = 50;
    } else {
      patternScores['clean-code'] = 100;
    }

    // Any type usage (-5 points)
    if (analysis.hasAnyType === true) {
      score -= 5;
      deductions.push({ rule: 'no-any-type', issue: 'Uses `any` type', points: 5 });
      patternScores['type-safety'] = 50;
    } else {
      patternScores['type-safety'] = 100;
    }
  }

  // Test file coverage check
  const testsWritten = params.testsWritten || [];
  const filesModified = params.filesModified || [];
  const sourceFiles = filesModified.filter(f =>
    (f.endsWith('.ts') || f.endsWith('.tsx')) &&
    !f.includes('.test.') &&
    !f.includes('.spec.')
  );

  if (sourceFiles.length > 0 && testsWritten.length === 0) {
    score -= 10;
    deductions.push({ rule: 'test-coverage', issue: 'No test files written for source files', points: 10 });
    patternScores['test-coverage'] = 0;
  } else if (testsWritten.length < sourceFiles.length) {
    score -= 5;
    deductions.push({ rule: 'test-coverage', issue: 'Not all source files have tests', points: 5 });
    patternScores['test-coverage'] = 50;
  } else {
    patternScores['test-coverage'] = 100;
  }

  return {
    score: Math.max(0, score),
    deductions,
    patternScores,
  };
}

/**
 * Calculate test quality metrics
 */
function calculateTestQuality(params: {
  testsWritten?: string[];
  testsPassed?: boolean;
  testCoverage?: number;
}): {
  overallScore: number;
  hasUnitTests: boolean;
  hasIntegrationTests: boolean;
  hasE2eTests: boolean;
  hasHappyPath: boolean;
  hasErrorCases: boolean;
  hasBoundaryCases: boolean;
  hasEdgeCases: boolean;
  missingTests: string[];
  recommendations: string[];
} {
  const testsWritten = params.testsWritten || [];
  const testsPassed = params.testsPassed || false;
  const testCoverage = params.testCoverage || 0;

  // Detect test types from file names
  const hasUnitTests = testsWritten.some(f =>
    f.includes('.test.') || f.includes('.spec.') || f.includes('/__tests__/')
  );
  const hasIntegrationTests = testsWritten.some(f =>
    f.includes('integration') || f.includes('/api/')
  );
  const hasE2eTests = testsWritten.some(f =>
    f.includes('e2e') || f.includes('.spec.ts') || f.includes('playwright')
  );

  // Default to true if tests exist (we can't know content without reading files)
  const hasHappyPath = testsWritten.length > 0;
  const hasErrorCases = testsWritten.length > 0;
  const hasBoundaryCases = testsWritten.length >= 2;
  const hasEdgeCases = testsWritten.length >= 3;

  // Calculate score
  let overallScore = 0;
  if (testsPassed) overallScore += 30;
  if (testsWritten.length > 0) overallScore += 20;
  if (hasUnitTests) overallScore += 15;
  if (hasIntegrationTests) overallScore += 15;
  if (hasE2eTests) overallScore += 10;
  if (testCoverage >= 80) overallScore += 10;
  else if (testCoverage >= 50) overallScore += 5;

  // Generate recommendations
  const missingTests: string[] = [];
  const recommendations: string[] = [];

  if (!hasUnitTests) {
    missingTests.push('Unit tests');
    recommendations.push('Add unit tests for individual functions/components');
  }
  if (!hasIntegrationTests) {
    missingTests.push('Integration tests');
    recommendations.push('Add integration tests for API routes');
  }
  if (!hasE2eTests && testsWritten.length > 0) {
    recommendations.push('Consider adding E2E tests for critical user flows');
  }
  if (testCoverage < 50) {
    recommendations.push('Increase test coverage to at least 50%');
  }
  if (!testsPassed && testsWritten.length > 0) {
    recommendations.push('Fix failing tests before marking complete');
  }

  return {
    overallScore,
    hasUnitTests,
    hasIntegrationTests,
    hasE2eTests,
    hasHappyPath,
    hasErrorCases,
    hasBoundaryCases,
    hasEdgeCases,
    missingTests,
    recommendations,
  };
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

    // Also fetch compliance and test quality if available
    const compliance = await db.query.patternCompliance.findFirst({
      where: eq(patternCompliance.sessionId, session.id),
    });

    const testQuality = await db.query.testQualityMetrics.findFirst({
      where: eq(testQualityMetrics.sessionId, session.id),
    });

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

      // v6.1 enhancements
      compliance: compliance ? {
        score: compliance.complianceScore,
        deductions: JSON.parse(compliance.deductions || '[]'),
      } : null,
      testQuality: testQuality ? {
        overallScore: testQuality.overallScore,
        coverage: testQuality.coveragePercent,
        hasUnitTests: testQuality.hasUnitTests,
        hasIntegrationTests: testQuality.hasIntegrationTests,
        hasE2eTests: testQuality.hasE2eTests,
      } : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
