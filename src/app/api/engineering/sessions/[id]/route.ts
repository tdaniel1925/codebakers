import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { db } from '@/db';
import { engineeringSessions, engineeringMessages, teamMembers } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { ENGINEERING_PHASES, EngineeringPhase, AgentRole } from '@/lib/engineering-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineering/sessions/[id]
 * Get a specific engineering session with full details
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

    const teamIds = userTeams.map((t) => t.teamId).filter((id): id is string => id !== null);

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

    // Get messages for this session
    const messages = await db
      .select()
      .from(engineeringMessages)
      .where(eq(engineeringMessages.sessionId, id))
      .orderBy(desc(engineeringMessages.createdAt))
      .limit(100);

    // Parse JSON fields
    const scope = record.scope ? JSON.parse(record.scope) : null;
    const stack = record.stack ? JSON.parse(record.stack) : null;
    const gateStatus = record.gateStatus ? JSON.parse(record.gateStatus) : {};
    const artifacts = record.artifacts ? JSON.parse(record.artifacts) : {};
    const dependencyGraph = record.dependencyGraph ? JSON.parse(record.dependencyGraph) : { nodes: [], edges: [] };

    // Calculate progress
    const phases: EngineeringPhase[] = [
      'scoping', 'requirements', 'architecture', 'design_review', 'implementation',
      'code_review', 'testing', 'security_review', 'documentation', 'staging', 'launch'
    ];
    const completedPhases = phases.filter((p) => gateStatus[p]?.status === 'passed').length;
    const progress = Math.round((completedPhases / phases.length) * 100);

    // Build phase progress array
    const phaseProgress = ENGINEERING_PHASES.map((phaseConfig) => {
      const gate = gateStatus[phaseConfig.phase];
      return {
        phase: phaseConfig.phase,
        displayName: phaseConfig.displayName,
        description: phaseConfig.description,
        agent: phaseConfig.agent,
        status: gate?.status || 'pending',
        passedAt: gate?.passedAt || null,
        failedReason: gate?.failedReason || null,
        isCurrent: record.currentPhase === phaseConfig.phase,
      };
    });

    // Get current phase config
    const currentPhaseConfig = ENGINEERING_PHASES.find((p) => p.phase === record.currentPhase);

    // Transform messages
    const formattedMessages = messages.map((m) => ({
      id: m.id,
      fromAgent: m.fromAgent,
      toAgent: m.toAgent,
      messageType: m.messageType,
      content: m.content,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      createdAt: m.createdAt,
    }));

    return successResponse({
      session: {
        id: record.id,
        teamId: record.teamId,
        projectHash: record.projectHash,
        projectName: record.projectName,
        projectDescription: record.projectDescription,
        status: record.status,
        currentPhase: record.currentPhase,
        currentPhaseDisplay: currentPhaseConfig?.displayName || record.currentPhase,
        currentPhaseDescription: currentPhaseConfig?.description || '',
        currentAgent: record.currentAgent,
        isRunning: record.isRunning,
        progress,
        scope,
        stack,
        phaseProgress,
        artifacts: {
          hasPrd: !!artifacts.prd,
          hasTechSpec: !!artifacts.techSpec,
          hasApiDocs: !!artifacts.apiDocs,
          hasSecurityAudit: !!artifacts.securityAudit,
          hasUserGuide: !!artifacts.userGuide,
          hasDeploymentGuide: !!artifacts.deploymentGuide,
        },
        dependencyGraph: {
          nodeCount: dependencyGraph.nodes?.length || 0,
          edgeCount: dependencyGraph.edges?.length || 0,
        },
        lastError: record.lastError,
        errorCount: record.errorCount,
        totalApiCalls: record.totalApiCalls,
        totalTokensUsed: record.totalTokensUsed,
        startedAt: record.startedAt,
        pausedAt: record.pausedAt,
        completedAt: record.completedAt,
        lastActivityAt: record.lastActivityAt,
      },
      messages: formattedMessages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
