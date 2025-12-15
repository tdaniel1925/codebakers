import { createClient } from '@/lib/supabase/server';
import { db, profiles } from '@/db';
import { eq } from 'drizzle-orm';

export async function getServerSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user } : null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return profile?.isAdmin ?? false;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  const admin = await isAdmin(session.user.id);
  if (!admin) {
    throw new Error('Admin access required');
  }
  return session;
}
