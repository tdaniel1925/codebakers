import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AnalyticsService } from '@/services/analytics-service';
import { TeamService } from '@/services/team-service';
import { AnalyticsContent } from './analytics-content';

export default async function AnalyticsPage() {
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

  // Fetch analytics data
  const stats = await AnalyticsService.getUsageStats(team.id, 30);
  const timeSaved = await AnalyticsService.getEstimatedTimeSaved(team.id, 30);

  return (
    <AnalyticsContent
      stats={stats}
      timeSaved={timeSaved}
    />
  );
}
