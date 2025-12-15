import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is admin to show admin link in sidebar
  const admin = await isAdmin(user.id);

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardSidebar user={user} isAdmin={admin} />
      {/* Main content - offset for sidebar */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
