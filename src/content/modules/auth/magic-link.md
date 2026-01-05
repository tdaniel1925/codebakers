# Magic Link Authentication

> Copy-paste ready. Passwordless login via email link.

## Send Magic Link

```typescript
// app/api/auth/magic-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const MagicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = MagicLinkSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = result.data;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        shouldCreateUser: true, // Create user if doesn't exist
      },
    });

    if (error) {
      // Don't reveal if email exists or not
      console.error('Magic Link Error:', error);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account exists, you will receive a login link.',
    });
  } catch (error) {
    console.error('Magic Link Error:', error);
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    );
  }
}
```

## Magic Link Form Component

```typescript
// components/MagicLinkForm.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center p-6 bg-green-50 rounded-lg">
        <h3 className="font-semibold text-green-800">Check your email</h3>
        <p className="text-green-600 mt-2">
          We sent a login link to {email}
        </p>
        <Button
          variant="link"
          onClick={() => setSent(false)}
          className="mt-4"
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending...' : 'Send Magic Link'}
      </Button>
    </form>
  );
}
```

## Callback Handler

```typescript
// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (token_hash && type === 'magiclink') {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash,
    });

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_link`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
  }

  // Handle code exchange for other auth methods
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_callback`
  );
}
```

## Test

```typescript
// app/api/auth/magic-link/route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe('POST /api/auth/magic-link', () => {
  it('sends magic link for valid email', async () => {
    const req = new Request('http://test/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('returns success even for non-existent email', async () => {
    // Prevents email enumeration
    const req = new Request('http://test/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown@example.com' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200); // Still 200
  });
});
```

## Usage
Use for passwordless authentication. Better UX for users who forget passwords.
