import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardService } from '@/services/dashboard-service';
import { TeamService } from '@/services/team-service';
import { AccountContent } from './account-content';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [stats, team, apiKey] = await Promise.all([
    DashboardService.getStats(user.id),
    TeamService.getByOwnerId(user.id),
    DashboardService.getPrimaryKey(user.id),
  ]);

  return (
    <AccountContent
      user={user}
      stats={stats}
      team={team}
      apiKey={apiKey ? apiKey.keyPrefix : null}
    />
  );
}
