import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin-sidebar';

export default async function AdminLayout({
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

  const admin = await isAdmin(user.id);
  if (!admin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminSidebar user={user} />
      {/* Main content - offset for sidebar */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
