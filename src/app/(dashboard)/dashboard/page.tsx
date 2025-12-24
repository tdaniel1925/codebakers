import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardService } from '@/services/dashboard-service';
import { DashboardContent } from './dashboard-content';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Ensure team exists
  await DashboardService.ensureTeamExists(user.id, user.email!);

  const stats = await DashboardService.getStats(user.id);
  const apiKey = await DashboardService.getPrimaryKey(user.id);

  // Redirect new users to quick start if they haven't set up yet
  if (!stats.lastApiCall && !apiKey) {
    redirect('/quickstart');
  }

  return <DashboardContent stats={stats} apiKey={apiKey} />;
}
