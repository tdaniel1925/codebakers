import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { DashboardService } from '@/services/dashboard-service';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Create profile and team if needed
      const team = await DashboardService.ensureTeamExists(data.user.id, data.user.email!);

      // Check if user needs onboarding
      const needsOnboarding = !team.onboardingCompletedAt;

      if (needsOnboarding) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
