import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { db } from '@/db';
import { engineeringSessions, engineeringMessages, teamMembers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineering/sessions/[id]/progress
 * Get build progress including generated files
 *
 * This endpoint is polled by the CLI to get real-time progress and files.
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

    // Parse stored data
    const gateStatus = record.gateStatus ? JSON.parse(record.gateStatus) : {};
    const artifacts = record.artifacts ? JSON.parse(record.artifacts) : {};
    const generatedFiles = record.generatedFiles ? JSON.parse(record.generatedFiles) : [];

    // Calculate phases progress
    const phaseOrder = [
      { phase: 'scoping', displayName: 'Scoping' },
      { phase: 'requirements', displayName: 'Requirements' },
      { phase: 'architecture', displayName: 'Architecture' },
      { phase: 'design_review', displayName: 'Design Review' },
      { phase: 'implementation', displayName: 'Implementation' },
      { phase: 'code_review', displayName: 'Code Review' },
      { phase: 'testing', displayName: 'Testing' },
      { phase: 'security_review', displayName: 'Security Review' },
      { phase: 'documentation', displayName: 'Documentation' },
      { phase: 'staging', displayName: 'Staging' },
      { phase: 'launch', displayName: 'Launch' },
    ];

    const phases = phaseOrder.map(p => ({
      phase: p.phase,
      displayName: p.displayName,
      status: gateStatus[p.phase]?.status || 'pending',
      passedAt: gateStatus[p.phase]?.passedAt || null,
    }));

    const completedPhases = phases.filter(p => p.status === 'passed').length;
    const progress = Math.round((completedPhases / phases.length) * 100);

    // Get recent messages for context
    const messages = await db
      .select({
        id: engineeringMessages.id,
        fromAgent: engineeringMessages.fromAgent,
        messageType: engineeringMessages.messageType,
        content: engineeringMessages.content,
        createdAt: engineeringMessages.createdAt,
      })
      .from(engineeringMessages)
      .where(eq(engineeringMessages.sessionId, id))
      .orderBy(desc(engineeringMessages.createdAt))
      .limit(20);

    // Get new files that were added since last check
    // The CLI tracks which files it has received via lastFileId query param
    const lastFileId = req.nextUrl.searchParams.get('lastFileId');
    let newFiles: Array<{ path: string; content: string; type: string }> = [];

    if (generatedFiles.length > 0) {
      if (lastFileId) {
        const lastIdx = generatedFiles.findIndex((f: { id: string }) => f.id === lastFileId);
        if (lastIdx >= 0 && lastIdx < generatedFiles.length - 1) {
          newFiles = generatedFiles.slice(lastIdx + 1);
        }
      } else {
        // First request - don't send all files yet, wait until build is complete
        // or send progressively during implementation phase
        if (record.status === 'completed') {
          newFiles = generatedFiles;
        }
      }
    }

    return successResponse({
      id: record.id,
      status: record.status || 'active',
      currentPhase: record.currentPhase || 'scoping',
      currentAgent: record.currentAgent || 'orchestrator',
      isRunning: record.isRunning ?? false,
      progress,
      phases,
      artifacts: {
        hasPrd: !!artifacts.prd,
        hasTechSpec: !!artifacts.techSpec,
        hasSecurityAudit: !!artifacts.securityAudit,
      },
      lastError: record.lastError,
      totalApiCalls: record.totalApiCalls || 0,
      totalTokensUsed: record.totalTokensUsed || 0,
      // Files for CLI to write
      files: record.status === 'completed' ? generatedFiles : [],
      newFiles,
      // Summary for CLI display
      summary: {
        filesCreated: generatedFiles.length,
        phases: completedPhases,
        tokensUsed: record.totalTokensUsed || 0,
      },
      messages: messages.reverse(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
