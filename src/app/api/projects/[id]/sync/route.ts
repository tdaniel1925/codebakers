import { NextRequest } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, AuthorizationError } from '@/lib/errors';
import { z } from 'zod';
import { db, projects } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Bulk sync schema - allows CLI to sync all project data in one call
 * This is the main endpoint for CLI to keep server in sync with local state
 */
const bulkSyncSchema = z.object({
  // Project updates
  project: z.object({
    status: z.enum(['discovery', 'planning', 'building', 'testing', 'completed', 'paused', 'failed']).optional(),
    overallProgress: z.number().min(0).max(100).optional(),
    prdContent: z.string().optional(),
    discoveryAnswers: z.record(z.string(), z.unknown()).optional(),
    patternsUsed: z.array(z.string()).optional(),
    detectedStack: z.record(z.string(), z.string()).optional(),
  }).optional(),

  // Phases to sync
  phases: z.array(z.object({
    id: z.string().uuid().optional(), // If provided, update; otherwise create
    phaseNumber: z.number(),
    phaseName: z.string(),
    phaseDescription: z.string().optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'failed']).optional(),
    progress: z.number().min(0).max(100).optional(),
    requiredPatterns: z.array(z.string()).optional(),
    aiConfidence: z.number().min(0).max(100).optional(),
    aiNotes: z.string().optional(),
    alternativesConsidered: z.array(z.string()).optional(),
    requiresApproval: z.boolean().optional(),
  })).optional(),

  // Events to record
  events: z.array(z.object({
    eventType: z.string(),
    eventTitle: z.string(),
    eventDescription: z.string().optional(),
    eventData: z.record(z.string(), z.unknown()).optional(),
    phaseId: z.string().uuid().optional(),
    featureId: z.string().uuid().optional(),
    filePath: z.string().optional(),
    fileAction: z.string().optional(),
    linesChanged: z.number().optional(),
    aiConfidence: z.number().optional(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    riskReason: z.string().optional(),
  })).optional(),

  // Test runs to record
  testRuns: z.array(z.object({
    testType: z.string(),
    testCommand: z.string().optional(),
    passed: z.boolean(),
    totalTests: z.number().default(0),
    passedTests: z.number().default(0),
    failedTests: z.number().default(0),
    skippedTests: z.number().default(0),
    durationMs: z.number().optional(),
    phaseId: z.string().uuid().optional(),
    featureId: z.string().uuid().optional(),
  })).optional(),

  // Files to track
  files: z.array(z.object({
    filePath: z.string(),
    fileName: z.string(),
    fileType: z.string().optional(),
    lineCount: z.number().optional(),
    complexity: z.number().optional(),
    parentPath: z.string().optional(),
    depth: z.number().optional(),
    status: z.enum(['active', 'deleted', 'renamed']).optional(),
    featureId: z.string().uuid().optional(),
  })).optional(),

  // Dependencies to track
  dependencies: z.array(z.object({
    sourceFile: z.string(),
    sourceType: z.string().optional(),
    targetFile: z.string(),
    targetType: z.string().optional(),
    dependencyType: z.string().optional(),
    importName: z.string().optional(),
    featureId: z.string().uuid().optional(),
  })).optional(),

  // Risk flags to create
  riskFlags: z.array(z.object({
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    riskCategory: z.string(),
    riskTitle: z.string(),
    riskDescription: z.string().optional(),
    triggerFile: z.string().optional(),
    triggerCode: z.string().optional(),
    triggerReason: z.string().optional(),
    aiRecommendation: z.string().optional(),
    phaseId: z.string().uuid().optional(),
    featureId: z.string().uuid().optional(),
  })).optional(),

  // Resource usage to track
  resources: z.array(z.object({
    resourceType: z.string(),
    apiEndpoint: z.string().optional(),
    apiMethod: z.string().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    durationMs: z.number().optional(),
    estimatedCostMillicents: z.number().optional(),
    phaseId: z.string().uuid().optional(),
    featureId: z.string().uuid().optional(),
  })).optional(),

  // Create snapshot
  createSnapshot: z.object({
    snapshotName: z.string(),
    snapshotDescription: z.string().optional(),
    isAutomatic: z.boolean().optional(),
    gitCommitHash: z.string().optional(),
    gitBranch: z.string().optional(),
    projectState: z.record(z.string(), z.unknown()).optional(),
    fileTree: z.array(z.record(z.string(), z.unknown())).optional(),
    phaseId: z.string().uuid().optional(),
  }).optional(),
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
 * POST /api/projects/[id]/sync
 * Bulk sync endpoint - sync all project data in one efficient call
 * This is the main endpoint the CLI uses to keep the server updated
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthOrApiKey(req);
    const { id: projectId } = await params;
    applyRateLimit(req, 'api:projects:sync', auth.userId);

    await verifyProjectOwnership(projectId, auth.teamId);

    const body = await req.json();
    const data = bulkSyncSchema.parse(body);

    const results: Record<string, unknown> = {
      projectId,
      synced: {
        project: false,
        phases: 0,
        events: 0,
        testRuns: 0,
        files: 0,
        dependencies: 0,
        riskFlags: 0,
        resources: 0,
        snapshot: false,
      },
    };

    // 1. Update project if provided
    if (data.project) {
      const updates: Record<string, unknown> = {};
      if (data.project.prdContent) updates.prdContent = data.project.prdContent;
      if (data.project.discoveryAnswers) updates.discoveryAnswers = JSON.stringify(data.project.discoveryAnswers);
      if (data.project.patternsUsed) updates.patternsUsed = JSON.stringify(data.project.patternsUsed);
      if (data.project.detectedStack) updates.detectedStack = JSON.stringify(data.project.detectedStack);
      if (data.project.overallProgress !== undefined) updates.overallProgress = data.project.overallProgress;

      if (data.project.status) {
        await ProjectTrackingService.updateProjectStatus(projectId, data.project.status, updates);
      } else if (Object.keys(updates).length > 0) {
        await db
          .update(projects)
          .set({ ...updates, lastActivityAt: new Date(), updatedAt: new Date() })
          .where(eq(projects.id, projectId));
      }
      results.synced = { ...(results.synced as object), project: true };
    }

    // 2. Sync phases
    if (data.phases && data.phases.length > 0) {
      for (const phase of data.phases) {
        await ProjectTrackingService.createPhase({
          projectId,
          phaseNumber: phase.phaseNumber,
          phaseName: phase.phaseName,
          phaseDescription: phase.phaseDescription,
          status: phase.status,
          progress: phase.progress,
          requiredPatterns: phase.requiredPatterns ? JSON.stringify(phase.requiredPatterns) : undefined,
          aiConfidence: phase.aiConfidence,
          aiNotes: phase.aiNotes,
          alternativesConsidered: phase.alternativesConsidered ? JSON.stringify(phase.alternativesConsidered) : undefined,
          requiresApproval: phase.requiresApproval,
        });
      }
      results.synced = { ...(results.synced as object), phases: data.phases.length };
    }

    // 3. Record events
    if (data.events && data.events.length > 0) {
      for (const event of data.events) {
        await ProjectTrackingService.recordEvent(
          projectId,
          event.phaseId ?? null,
          event.featureId ?? null,
          {
            eventType: event.eventType as Parameters<typeof ProjectTrackingService.recordEvent>[3]['eventType'],
            eventTitle: event.eventTitle,
            eventDescription: event.eventDescription,
            eventData: event.eventData ? JSON.stringify(event.eventData) : undefined,
            filePath: event.filePath,
            fileAction: event.fileAction,
            linesChanged: event.linesChanged,
            aiConfidence: event.aiConfidence,
            riskLevel: event.riskLevel,
            riskReason: event.riskReason,
          }
        );
      }
      results.synced = { ...(results.synced as object), events: data.events.length };
    }

    // 4. Record test runs
    if (data.testRuns && data.testRuns.length > 0) {
      for (const testRun of data.testRuns) {
        await ProjectTrackingService.recordTestRun({
          projectId,
          phaseId: testRun.phaseId,
          featureId: testRun.featureId,
          testType: testRun.testType,
          testCommand: testRun.testCommand,
          passed: testRun.passed,
          totalTests: testRun.totalTests,
          passedTests: testRun.passedTests,
          failedTests: testRun.failedTests,
          skippedTests: testRun.skippedTests,
          durationMs: testRun.durationMs,
          completedAt: new Date(),
        });
      }
      results.synced = { ...(results.synced as object), testRuns: data.testRuns.length };
    }

    // 5. Record files
    if (data.files && data.files.length > 0) {
      for (const file of data.files) {
        if (file.status === 'deleted') {
          await ProjectTrackingService.markFileDeleted(projectId, file.filePath);
        } else {
          await ProjectTrackingService.recordFile({
            projectId,
            filePath: file.filePath,
            fileName: file.fileName,
            fileType: file.fileType,
            lineCount: file.lineCount,
            complexity: file.complexity,
            parentPath: file.parentPath,
            depth: file.depth,
            createdByFeatureId: file.featureId,
          });
        }
      }
      results.synced = { ...(results.synced as object), files: data.files.length };
    }

    // 6. Record dependencies
    if (data.dependencies && data.dependencies.length > 0) {
      for (const dep of data.dependencies) {
        await ProjectTrackingService.recordDependency({
          projectId,
          sourceFile: dep.sourceFile,
          sourceType: dep.sourceType,
          targetFile: dep.targetFile,
          targetType: dep.targetType,
          dependencyType: dep.dependencyType,
          importName: dep.importName,
          featureId: dep.featureId,
        });
      }
      results.synced = { ...(results.synced as object), dependencies: data.dependencies.length };
    }

    // 7. Create risk flags
    if (data.riskFlags && data.riskFlags.length > 0) {
      for (const flag of data.riskFlags) {
        await ProjectTrackingService.createRiskFlag({
          projectId,
          phaseId: flag.phaseId,
          featureId: flag.featureId,
          riskLevel: flag.riskLevel,
          riskCategory: flag.riskCategory,
          riskTitle: flag.riskTitle,
          riskDescription: flag.riskDescription,
          triggerFile: flag.triggerFile,
          triggerCode: flag.triggerCode,
          triggerReason: flag.triggerReason,
          aiRecommendation: flag.aiRecommendation,
        });
      }
      results.synced = { ...(results.synced as object), riskFlags: data.riskFlags.length };
    }

    // 8. Record resource usage
    if (data.resources && data.resources.length > 0) {
      for (const resource of data.resources) {
        await ProjectTrackingService.recordResourceUsage({
          projectId,
          phaseId: resource.phaseId,
          featureId: resource.featureId,
          resourceType: resource.resourceType,
          apiEndpoint: resource.apiEndpoint,
          apiMethod: resource.apiMethod,
          inputTokens: resource.inputTokens,
          outputTokens: resource.outputTokens,
          totalTokens: resource.totalTokens,
          durationMs: resource.durationMs,
          estimatedCostMillicents: resource.estimatedCostMillicents,
        });
      }
      results.synced = { ...(results.synced as object), resources: data.resources.length };
    }

    // 9. Create snapshot if requested
    if (data.createSnapshot) {
      await ProjectTrackingService.createSnapshot({
        projectId,
        phaseId: data.createSnapshot.phaseId,
        snapshotName: data.createSnapshot.snapshotName,
        snapshotDescription: data.createSnapshot.snapshotDescription,
        isAutomatic: data.createSnapshot.isAutomatic,
        gitCommitHash: data.createSnapshot.gitCommitHash,
        gitBranch: data.createSnapshot.gitBranch,
        projectState: data.createSnapshot.projectState ? JSON.stringify(data.createSnapshot.projectState) : undefined,
        fileTree: data.createSnapshot.fileTree ? JSON.stringify(data.createSnapshot.fileTree) : undefined,
      });
      results.synced = { ...(results.synced as object), snapshot: true };
    }

    return successResponse(results);
  } catch (error) {
    return handleApiError(error);
  }
}
