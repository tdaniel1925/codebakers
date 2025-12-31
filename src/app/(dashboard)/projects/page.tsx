import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TeamService } from '@/services/team-service';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { ProjectsListContent } from './projects-list-content';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
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

  const projects = await ProjectTrackingService.getTeamProjects(team.id);

  return <ProjectsListContent projects={projects} />;
}
