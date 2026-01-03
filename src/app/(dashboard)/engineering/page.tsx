import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardService } from '@/services/dashboard-service';
import { EngineeringContent } from './engineering-content';
import { db } from '@/db';
import { engineeringSessions, teamMembers } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { ENGINEERING_PHASES, EngineeringPhase } from '@/lib/engineering-types';

export default async function EngineeringPage() {
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

  if (userTeams.length === 0) {
    return <EngineeringContent sessions={[]} stats={null} />;
  }

  // Filter out any null teamIds
  const teamIds = userTeams.map((t) => t.teamId).filter((id): id is string => id !== null);
  if (teamIds.length === 0) {
    return <EngineeringContent sessions={[]} stats={null} />;
  }

  // Get engineering sessions
  const records = await db
    .select()
    .from(engineeringSessions)
    .where(inArray(engineeringSessions.teamId, teamIds))
    .orderBy(desc(engineeringSessions.lastActivityAt))
    .limit(20);

  // Transform records
  const sessions = records.map((record) => {
    const gateStatus = record.gateStatus ? JSON.parse(record.gateStatus) : {};
    const artifacts = record.artifacts ? JSON.parse(record.artifacts) : {};
    const scope = record.scope ? JSON.parse(record.scope) : { name: record.projectName };

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
      projectName: scope.name || record.projectName,
      projectDescription: scope.description || record.projectDescription || '',
      status: record.status as 'active' | 'paused' | 'completed' | 'abandoned',
      currentPhase: record.currentPhase as EngineeringPhase,
      currentPhaseDisplay: currentPhaseConfig?.displayName || record.currentPhase || 'Unknown',
      currentAgent: record.currentAgent || 'orchestrator',
      progress,
      startedAt: record.startedAt,
      lastActivityAt: record.lastActivityAt,
      completedAt: record.completedAt,
      hasArtifacts: Object.keys(artifacts).length > 0,
    };
  });

  // Calculate stats
  const stats = {
    totalBuilds: records.length,
    activeBuilds: records.filter((r) => r.status === 'active').length,
    completedBuilds: records.filter((r) => r.status === 'completed').length,
  };

  return <EngineeringContent sessions={sessions} stats={stats} />;
}
