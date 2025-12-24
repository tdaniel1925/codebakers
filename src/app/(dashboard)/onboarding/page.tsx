// Redirect old onboarding URL to new quickstart page
import { redirect } from 'next/navigation';

export default function OnboardingPage() {
  redirect('/quickstart');
}
