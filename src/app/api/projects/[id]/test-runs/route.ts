import { NextRequest } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, AuthorizationError } from '@/lib/errors';
import { z } from 'zod';
import { db, projects } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const createTestRunSchema = z.object({
  testType: z.string().min(1), // unit, integration, e2e, playwright, vitest
  testCommand: z.string().optional(),
  passed: z.boolean(),
  totalTests: z.number().default(0),
  passedTests: z.number().default(0),
  failedTests: z.number().default(0),
  skippedTests: z.number().default(0),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  failureDetails: z.array(z.record(z.string(), z.unknown())).optional(),
  durationMs: z.number().optional(),
  phaseId: z.string().uuid().optional(),
  featureId: z.string().uuid().optional(),
});

async function verifyProjectOwnership(projectId: string, teamId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project');
  }

  if (project.teamId !== teamId) {
    throw new AuthorizationError('You do not have access to this project');
  }

  return { project };
}

/**
 * GET /api/projects/[id]/test-runs
 * Get test run history for a project
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthOrApiKey(req);
    const { id } = await params;
    applyRateLimit(req, 'api:projects:read', auth.userId);

    await verifyProjectOwnership(id, auth.teamId);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const testRuns = await ProjectTrackingService.getProjectTestRuns(id, limit);

    return successResponse({
      testRuns: testRuns.map((tr) => ({
        id: tr.id,
        testType: tr.testType,
        testCommand: tr.testCommand,
        passed: tr.passed,
        totalTests: tr.totalTests,
        passedTests: tr.passedTests,
        failedTests: tr.failedTests,
        skippedTests: tr.skippedTests,
        durationMs: tr.durationMs,
        startedAt: tr.startedAt,
        completedAt: tr.completedAt,
        phaseId: tr.phaseId,
        featureId: tr.featureId,
        failureDetails: tr.failureDetails ? JSON.parse(tr.failureDetails) : null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects/[id]/test-runs
 * Record a new test run
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthOrApiKey(req);
    const { id } = await params;
    applyRateLimit(req, 'api:projects:write', auth.userId);

    await verifyProjectOwnership(id, auth.teamId);

    const body = await req.json();
    const data = createTestRunSchema.parse(body);

    const testRun = await ProjectTrackingService.recordTestRun({
      projectId: id,
      phaseId: data.phaseId,
      featureId: data.featureId,
      testType: data.testType,
      testCommand: data.testCommand,
      passed: data.passed,
      totalTests: data.totalTests,
      passedTests: data.passedTests,
      failedTests: data.failedTests,
      skippedTests: data.skippedTests,
      stdout: data.stdout,
      stderr: data.stderr,
      failureDetails: data.failureDetails ? JSON.stringify(data.failureDetails) : undefined,
      durationMs: data.durationMs,
      completedAt: new Date(),
    });

    return successResponse({
      testRun: {
        id: testRun.id,
        passed: testRun.passed,
        totalTests: testRun.totalTests,
        passedTests: testRun.passedTests,
        failedTests: testRun.failedTests,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
