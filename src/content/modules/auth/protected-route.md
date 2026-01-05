# Protected Routes

> Copy-paste ready. Protect pages and API routes from unauthorized access.

## Server Component Protection

```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Welcome, {user.email}</p>
    </div>
  );
}
```

## Reusable Auth Check

```typescript
// lib/auth.ts
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireAuth(redirectTo = '/login') {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(redirectTo);
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();

  // Check if user is admin (from your database)
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/unauthorized');
  }

  return user;
}
```

```typescript
// app/admin/page.tsx
import { requireAdmin } from '@/lib/auth';

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>
      <p>Admin: {user.email}</p>
    </div>
  );
}
```

## Layout-Level Protection

```typescript
// app/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-100 p-4">
        <span>Logged in as: {user.email}</span>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

## API Route Protection

```typescript
// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin role
    const profile = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    if (profile[0]?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Admin logic here...
    const users = await db.select().from(profiles);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Client Component with Redirect

```typescript
// components/ProtectedContent.tsx
'use client';

import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

## Test

```typescript
// lib/auth.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from './auth';

describe('requireAuth', () => {
  it('redirects when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    await requireAuth();

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('returns user when authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: '123', email: 'test@example.com' } },
          error: null,
        }),
      },
    } as any);

    const user = await requireAuth();
    expect(user.email).toBe('test@example.com');
  });
});
```

## Usage
Use requireAuth() in server components and layouts. Check roles for admin routes.
