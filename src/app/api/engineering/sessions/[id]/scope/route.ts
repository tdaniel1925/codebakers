import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit, ValidationError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { db } from '@/db';
import { engineeringSessions, teamMembers } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { EngineeringOrchestratorService } from '@/services/engineering-orchestrator-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineering/sessions/[id]/scope
 * Submit a scoping wizard answer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    const authSession = await requireAuth();
    const userId = authSession.user.id;
    const { id } = await params;

    const body = await req.json();
    const { stepId, answer } = body;

    if (!stepId || typeof stepId !== 'string') {
      throw new ValidationError('stepId is required');
    }

    // Get user's teams to verify access
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId).filter((tid): tid is string => tid !== null);

    if (teamIds.length === 0) {
      throw new ForbiddenError('No team access');
    }

    // Get the session
    const [record] = await db
      .select()
      .from(engineeringSessions)
      .where(eq(engineeringSessions.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Session not found');
    }

    // Verify user has access to this session's team
    if (!teamIds.includes(record.teamId)) {
      throw new ForbiddenError('Access denied to this session');
    }

    // Handle "auto" step for zero-friction builds
    // This auto-completes scoping and moves to requirements phase
    if (stepId === 'auto') {
      // Mark scoping as complete
      const gateStatus = record.gateStatus ? JSON.parse(record.gateStatus) : {};
      gateStatus.scoping = {
        phase: 'scoping',
        status: 'passed',
        passedAt: new Date().toISOString(),
        approvedBy: 'auto',
        artifacts: ['scope.json'],
      };

      // Update session to requirements phase
      await db
        .update(engineeringSessions)
        .set({
          currentPhase: 'requirements',
          currentAgent: 'pm',
          gateStatus: JSON.stringify(gateStatus),
          lastActivityAt: new Date(),
        })
        .where(eq(engineeringSessions.id, id));

      return successResponse({
        nextStep: null,
        scopeComplete: true,
      });
    }

    if (answer === undefined) {
      throw new ValidationError('answer is required');
    }

    // Verify session is in scoping phase
    if (record.currentPhase !== 'scoping') {
      throw new ValidationError('Session is not in scoping phase');
    }

    // Process the scoping answer
    const result = await EngineeringOrchestratorService.processScopingAnswer(id, stepId, answer);

    return successResponse({
      nextStep: result.nextStep,
      scopeComplete: result.scopeComplete,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/engineering/sessions/[id]/scope
 * Get current scope for a session
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    const authSession = await requireAuth();
    const userId = authSession.user.id;
    const { id } = await params;

    // Get user's teams to verify access
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId).filter((tid): tid is string => tid !== null);

    if (teamIds.length === 0) {
      throw new ForbiddenError('No team access');
    }

    // Get the session
    const [record] = await db
      .select()
      .from(engineeringSessions)
      .where(eq(engineeringSessions.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Session not found');
    }

    // Verify user has access to this session's team
    if (!teamIds.includes(record.teamId)) {
      throw new ForbiddenError('Access denied to this session');
    }

    // Parse scope from database
    const scope = record.scope ? JSON.parse(record.scope) : null;

    return successResponse({ scope });
  } catch (error) {
    return handleApiError(error);
  }
}
