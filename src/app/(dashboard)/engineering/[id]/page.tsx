import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { DashboardService } from '@/services/dashboard-service';
import { SessionDetailContent } from './session-detail-content';
import { db } from '@/db';
import { engineeringSessions, engineeringMessages, teamMembers } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { ENGINEERING_PHASES, EngineeringPhase } from '@/lib/engineering-types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Ensure team exists
  await DashboardService.ensureTeamExists(user.id, user.email!);

  // Get user's teams
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  const teamIds = userTeams.map((t) => t.teamId).filter((tid): tid is string => tid !== null);

  if (teamIds.length === 0) {
    notFound();
  }

  // Get the session
  const [record] = await db
    .select()
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, id))
    .limit(1);

  if (!record) {
    notFound();
  }

  // Verify user has access to this session's team
  if (!teamIds.includes(record.teamId)) {
    notFound();
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
      status: (gate?.status || 'pending') as 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped',
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

  const session = {
    id: record.id,
    teamId: record.teamId,
    projectHash: record.projectHash,
    projectName: record.projectName,
    projectDescription: record.projectDescription,
    status: record.status as 'active' | 'paused' | 'completed' | 'abandoned',
    currentPhase: record.currentPhase as EngineeringPhase,
    currentPhaseDisplay: currentPhaseConfig?.displayName || record.currentPhase || 'Unknown',
    currentPhaseDescription: currentPhaseConfig?.description || '',
    currentAgent: record.currentAgent || 'orchestrator',
    isRunning: record.isRunning ?? false,
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
  };

  return <SessionDetailContent session={session} messages={formattedMessages} />;
}
