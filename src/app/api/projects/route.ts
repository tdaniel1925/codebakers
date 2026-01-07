import { NextRequest } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createProjectSchema = z.object({
  projectHash: z.string().min(1),
  projectName: z.string().min(1),
  projectDescription: z.string().optional(),
  detectedStack: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/projects
 * List all projects for the user's team
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthOrApiKey(req);
    applyRateLimit(req, 'api:projects:read', auth.userId);

    const projectsList = await ProjectTrackingService.getTeamProjects(auth.teamId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.codebakers.ai';

    return successResponse({
      projects: projectsList.map((p) => ({
        id: p.id,
        projectHash: p.projectHash,
        projectName: p.projectName,
        projectDescription: p.projectDescription,
        status: p.status,
        overallProgress: p.overallProgress,
        totalFilesCreated: p.totalFilesCreated,
        totalTestsRun: p.totalTestsRun,
        totalTestsPassed: p.totalTestsPassed,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        lastActivityAt: p.lastActivityAt,
        publicSlug: p.publicSlug,
        publicProgressUrl: p.publicSlug ? `${baseUrl}/p/${p.publicSlug}` : null,
        isPublicPageEnabled: p.isPublicPageEnabled,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects
 * Create or get a project by hash (idempotent)
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthOrApiKey(req);
    applyRateLimit(req, 'api:projects:write', auth.userId);

    const body = await req.json();
    const data = createProjectSchema.parse(body);

    const project = await ProjectTrackingService.getOrCreateProject(
      auth.teamId,
      data.projectHash,
      data.projectName,
      data.projectDescription
    );

    // Update detected stack if provided
    if (data.detectedStack) {
      await ProjectTrackingService.updateProjectStatus(project.id, project.status as 'discovery' | 'planning' | 'building' | 'testing' | 'completed' | 'paused' | 'failed', {
        detectedStack: JSON.stringify(data.detectedStack),
      });
    }

    // Build public progress URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.codebakers.ai';
    const publicProgressUrl = project.publicSlug ? `${baseUrl}/p/${project.publicSlug}` : null;

    return successResponse({
      project: {
        id: project.id,
        projectHash: project.projectHash,
        projectName: project.projectName,
        status: project.status,
        overallProgress: project.overallProgress,
        startedAt: project.startedAt,
        publicSlug: project.publicSlug,
        publicProgressUrl,
        isPublicPageEnabled: project.isPublicPageEnabled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
