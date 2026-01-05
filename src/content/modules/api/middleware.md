# API Middleware

> Copy-paste ready. Auth checks, logging, and request processing.

## Auth Middleware

```typescript
// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type AuthenticatedHandler = (
  req: NextRequest,
  context: { user: { id: string; email: string } }
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest) => {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      return handler(req, {
        user: { id: user.id, email: user.email! }
      });
    } catch (error) {
      console.error('Auth Error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}
```

```typescript
// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, { user }) => {
  // user is guaranteed to exist here
  return NextResponse.json({
    id: user.id,
    email: user.email,
  });
});

export const PUT = withAuth(async (req, { user }) => {
  const body = await req.json();

  // Update user profile...

  return NextResponse.json({ success: true });
});
```

## Role-Based Access

```typescript
// lib/role-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type Role = 'user' | 'admin' | 'superadmin';

export function withRole(allowedRoles: Role[]) {
  return function(handler: Function) {
    return async (req: NextRequest) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user role from database
      const dbUser = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      const userRole = dbUser[0]?.role || 'user';

      if (!allowedRoles.includes(userRole as Role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return handler(req, { user, role: userRole });
    };
  };
}
```

```typescript
// app/api/admin/users/route.ts
import { withRole } from '@/lib/role-middleware';

export const GET = withRole(['admin', 'superadmin'])(async (req, { user, role }) => {
  // Only admins can access this
  return NextResponse.json({ users: [] });
});
```

## Request Logging

```typescript
// lib/logging-middleware.ts
export function withLogging(handler: Function) {
  return async (req: NextRequest) => {
    const start = Date.now();
    const { pathname } = new URL(req.url);

    try {
      const response = await handler(req);

      console.log({
        method: req.method,
        path: pathname,
        status: response.status,
        duration: Date.now() - start,
      });

      return response;
    } catch (error) {
      console.error({
        method: req.method,
        path: pathname,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start,
      });
      throw error;
    }
  };
}
```

## Test

```typescript
// lib/auth-middleware.test.ts
import { describe, it, expect, vi } from 'vitest';
import { withAuth } from './auth-middleware';
import { NextResponse } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '123', email: 'test@example.com' } },
        error: null,
      }),
    },
  }),
}));

describe('withAuth', () => {
  it('passes user to handler when authenticated', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const req = new Request('http://test/api/profile');
    await wrapped(req as any);

    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ user: { id: '123', email: 'test@example.com' } })
    );
  });
});
```

## Usage
Wrap route handlers with middleware for consistent auth, logging, and request processing.
