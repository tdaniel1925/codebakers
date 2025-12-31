import { NextRequest } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, AuthorizationError } from '@/lib/errors';
import { z } from 'zod';
import { db, projects } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const updateProjectSchema = z.object({
  status: z.enum(['discovery', 'planning', 'building', 'testing', 'completed', 'paused', 'failed']).optional(),
  overallProgress: z.number().min(0).max(100).optional(),
  prdContent: z.string().optional(),
  discoveryAnswers: z.record(z.string(), z.unknown()).optional(),
  patternsUsed: z.array(z.string()).optional(),
});

/**
 * Verify the team owns the project
 */
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
 * GET /api/projects/[id]
 * Get project dashboard with full details
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

    const dashboard = await ProjectTrackingService.getProjectDashboard(id);
    if (!dashboard) {
      throw new NotFoundError('Project');
    }

    return successResponse(dashboard);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/projects/[id]
 * Update project status and metadata
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthOrApiKey(req);
    const { id } = await params;
    applyRateLimit(req, 'api:projects:write', auth.userId);

    await verifyProjectOwnership(id, auth.teamId);

    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    // Build update object
    const updates: Record<string, unknown> = {};
    if (data.prdContent) updates.prdContent = data.prdContent;
    if (data.discoveryAnswers) updates.discoveryAnswers = JSON.stringify(data.discoveryAnswers);
    if (data.patternsUsed) updates.patternsUsed = JSON.stringify(data.patternsUsed);
    if (data.overallProgress !== undefined) updates.overallProgress = data.overallProgress;

    let project;
    if (data.status) {
      project = await ProjectTrackingService.updateProjectStatus(id, data.status, updates);
    } else if (Object.keys(updates).length > 0) {
      // Just update metrics if no status change
      const [updated] = await db
        .update(projects)
        .set({ ...updates, lastActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      project = updated;
    } else {
      const [existing] = await db.select().from(projects).where(eq(projects.id, id));
      project = existing;
    }

    return successResponse({
      project: {
        id: project.id,
        status: project.status,
        overallProgress: project.overallProgress,
        lastActivityAt: project.lastActivityAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
