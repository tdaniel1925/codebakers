import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { TeamService } from '@/services/team-service';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { ProjectDashboardContent } from './project-dashboard-content';
import { db, projects } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const team = await TeamService.getByOwnerId(user.id);
  if (!team) {
    redirect('/dashboard');
  }

  // Verify project belongs to team
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project || project.teamId !== team.id) {
    notFound();
  }

  // Get full dashboard data
  const dashboard = await ProjectTrackingService.getProjectDashboard(id);
  if (!dashboard) {
    notFound();
  }

  // Get additional data for visualizations
  const [fileTree, testRuns] = await Promise.all([
    ProjectTrackingService.getProjectFileTree(id),
    ProjectTrackingService.getProjectTestRuns(id, 20),
  ]);

  return (
    <ProjectDashboardContent
      dashboard={dashboard}
      fileTree={fileTree}
      testRuns={testRuns}
    />
  );
}
