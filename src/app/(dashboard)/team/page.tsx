import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TeamService } from '@/services/team-service';
import { TeamInviteService } from '@/services/team-invite-service';
import { TeamContent } from './team-content';

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const team = await TeamService.getByOwnerId(user.id);
  if (!team) {
    redirect('/onboarding');
  }

  // Get team members and pending invites
  const members = await TeamInviteService.getTeamMembers(team.id);
  const pendingInvites = await TeamInviteService.getPendingInvites(team.id);

  return (
    <TeamContent
      team={{
        id: team.id,
        name: team.name,
        seatLimit: team.seatLimit || 1,
        ownerId: team.ownerId || '',
      }}
      members={members}
      pendingInvites={pendingInvites}
      currentUserId={user.id}
    />
  );
}
