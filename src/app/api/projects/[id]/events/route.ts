import { NextRequest } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, AuthorizationError } from '@/lib/errors';
import { z } from 'zod';
import { db, projects } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const createEventSchema = z.object({
  eventType: z.enum([
    'project_started', 'project_completed', 'project_paused', 'project_failed',
    'phase_started', 'phase_completed', 'phase_skipped', 'phase_failed',
    'feature_started', 'feature_completed', 'feature_blocked', 'feature_failed',
    'file_created', 'file_modified', 'file_deleted',
    'test_started', 'test_passed', 'test_failed',
    'approval_requested', 'approval_granted', 'approval_rejected',
    'snapshot_created', 'snapshot_restored',
    'ai_decision', 'ai_confidence', 'risk_flagged',
    'docs_generated', 'dependency_added', 'dependency_removed'
  ]),
  eventTitle: z.string().min(1),
  eventDescription: z.string().optional(),
  eventData: z.record(z.string(), z.unknown()).optional(),
  phaseId: z.string().uuid().optional(),
  featureId: z.string().uuid().optional(),
  filePath: z.string().optional(),
  fileAction: z.string().optional(),
  linesChanged: z.number().optional(),
  aiConfidence: z.number().min(0).max(100).optional(),
  alternativesConsidered: z.array(z.string()).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  riskReason: z.string().optional(),
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
 * GET /api/projects/[id]/events
 * Get timeline events for a project
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
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const events = await ProjectTrackingService.getProjectTimeline(id, limit, offset);

    return successResponse({ events });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects/[id]/events
 * Record a new event to the timeline
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
    const data = createEventSchema.parse(body);

    const event = await ProjectTrackingService.recordEvent(
      id,
      data.phaseId ?? null,
      data.featureId ?? null,
      {
        eventType: data.eventType,
        eventTitle: data.eventTitle,
        eventDescription: data.eventDescription,
        eventData: data.eventData ? JSON.stringify(data.eventData) : undefined,
        filePath: data.filePath,
        fileAction: data.fileAction,
        linesChanged: data.linesChanged,
        aiConfidence: data.aiConfidence,
        alternativesConsidered: data.alternativesConsidered ? JSON.stringify(data.alternativesConsidered) : undefined,
        riskLevel: data.riskLevel,
        riskReason: data.riskReason,
      }
    );

    return successResponse({ event });
  } catch (error) {
    return handleApiError(error);
  }
}
