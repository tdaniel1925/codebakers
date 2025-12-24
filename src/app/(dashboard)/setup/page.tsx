// Redirect old setup URL to new quickstart page
import { redirect } from 'next/navigation';

export default function SetupPage() {
  redirect('/quickstart');
}
