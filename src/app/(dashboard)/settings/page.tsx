import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TeamService } from '@/services/team-service';
import { ServiceKeysContent } from './service-keys-content';

export default async function SettingsPage() {
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

  // Parse existing service keys - check which ones are configured
  const allServiceKeys = [
    'github', 'supabase', 'vercel',  // Infrastructure
    'openai', 'anthropic',            // AI
    'stripe',                         // Payments
    'twilio_sid', 'twilio_auth', 'resend', 'vapi',  // Communication
    'sentry',                         // Monitoring
    'cloudinary', 'pexels', 'midjourney',  // Media
  ];
  let serviceKeys: Record<string, boolean> = {};

  if (team.serviceKeys) {
    try {
      const keys = JSON.parse(team.serviceKeys);
      allServiceKeys.forEach(key => {
        serviceKeys[key] = !!keys[key];
      });
    } catch {
      // Invalid JSON, use defaults
      allServiceKeys.forEach(key => {
        serviceKeys[key] = false;
      });
    }
  } else {
    allServiceKeys.forEach(key => {
      serviceKeys[key] = false;
    });
  }

  return (
    <ServiceKeysContent
      initialKeys={serviceKeys}
    />
  );
}
