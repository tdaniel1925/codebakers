import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit, ValidationError } from '@/lib/api-utils';
import { db } from '@/db';
import { engineeringSessions, teams, teamMembers } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { EngineeringPhase, AgentRole, ENGINEERING_PHASES } from '@/lib/engineering-types';
import { EngineeringOrchestratorService } from '@/services/engineering-orchestrator-service';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineering/sessions
 * Get engineering sessions for the current user's teams
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await requireAuth();
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'active' | 'paused' | 'completed' | 'abandoned' | null;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Get teams the user belongs to
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (userTeams.length === 0) {
      return successResponse({ sessions: [] });
    }

    // Filter out any null teamIds
    const teamIds = userTeams.map((t) => t.teamId).filter((id): id is string => id !== null);
    if (teamIds.length === 0) {
      return successResponse({ sessions: [] });
    }

    // Build query
    const conditions = [inArray(engineeringSessions.teamId, teamIds)];
    if (status) {
      conditions.push(eq(engineeringSessions.status, status));
    }

    // Get sessions
    const records = await db
      .select({
        id: engineeringSessions.id,
        teamId: engineeringSessions.teamId,
        projectHash: engineeringSessions.projectHash,
        projectName: engineeringSessions.projectName,
        projectDescription: engineeringSessions.projectDescription,
        status: engineeringSessions.status,
        currentPhase: engineeringSessions.currentPhase,
        currentAgent: engineeringSessions.currentAgent,
        gateStatus: engineeringSessions.gateStatus,
        artifacts: engineeringSessions.artifacts,
        startedAt: engineeringSessions.startedAt,
        lastActivityAt: engineeringSessions.lastActivityAt,
        completedAt: engineeringSessions.completedAt,
      })
      .from(engineeringSessions)
      .where(and(...conditions))
      .orderBy(desc(engineeringSessions.lastActivityAt))
      .limit(limit);

    // Transform records
    const sessions = records.map((record) => {
      const gateStatus = record.gateStatus ? JSON.parse(record.gateStatus) : {};
      const artifacts = record.artifacts ? JSON.parse(record.artifacts) : {};

      // Calculate progress
      const phases: EngineeringPhase[] = [
        'scoping', 'requirements', 'architecture', 'design_review', 'implementation',
        'code_review', 'testing', 'security_review', 'documentation', 'staging', 'launch'
      ];
      const completedPhases = phases.filter((p) => gateStatus[p]?.status === 'passed').length;
      const progress = Math.round((completedPhases / phases.length) * 100);

      // Get current phase display info
      const currentPhaseConfig = ENGINEERING_PHASES.find((p) => p.phase === record.currentPhase);

      return {
        id: record.id,
        teamId: record.teamId,
        projectHash: record.projectHash,
        projectName: record.projectName,
        projectDescription: record.projectDescription,
        status: record.status,
        currentPhase: record.currentPhase,
        currentPhaseDisplay: currentPhaseConfig?.displayName || record.currentPhase,
        currentAgent: record.currentAgent,
        progress,
        startedAt: record.startedAt,
        lastActivityAt: record.lastActivityAt,
        completedAt: record.completedAt,
        hasArtifacts: Object.keys(artifacts).length > 0,
      };
    });

    return successResponse({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/engineering/sessions
 * Start a new engineering session
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await requireAuth();
    const userId = session.user.id;

    const body = await req.json();
    const { projectName, projectDescription } = body;

    if (!projectName || typeof projectName !== 'string') {
      throw new ValidationError('projectName is required');
    }

    // Get user's primary team
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (userTeams.length === 0 || !userTeams[0].teamId) {
      throw new ValidationError('No team found for user');
    }

    const teamId = userTeams[0].teamId;

    // Generate project hash from name + timestamp for uniqueness
    const projectHash = createHash('sha256')
      .update(`${projectName}-${teamId}-${Date.now()}`)
      .digest('hex')
      .substring(0, 16);

    // Start the engineering session
    const { sessionId, firstStep } = await EngineeringOrchestratorService.startSession(
      teamId,
      projectHash,
      projectName.trim()
    );

    // Update description if provided
    if (projectDescription) {
      await db
        .update(engineeringSessions)
        .set({ projectDescription: projectDescription.trim() })
        .where(eq(engineeringSessions.id, sessionId));
    }

    return successResponse({
      sessionId,
      projectHash,
      firstStep,
      message: 'Engineering session started successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
