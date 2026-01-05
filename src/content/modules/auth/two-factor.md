# Two-Factor Authentication (2FA)

> Copy-paste ready. TOTP-based 2FA with Supabase Auth.

## Enable 2FA for User

```typescript
// app/api/auth/2fa/enroll/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Enroll in TOTP MFA
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      factorId: data.id,
      qrCode: data.totp.qr_code, // Base64 QR code image
      secret: data.totp.secret, // Manual entry secret
      uri: data.totp.uri, // otpauth:// URI
    });
  } catch (error) {
    console.error('2FA Enroll Error:', error);
    return NextResponse.json(
      { error: 'Failed to enroll 2FA' },
      { status: 500 }
    );
  }
}
```

## Verify and Activate 2FA

```typescript
// app/api/auth/2fa/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const VerifySchema = z.object({
  factorId: z.string(),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = VerifySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }

    const { factorId, code } = result.data;
    const supabase = await createClient();

    // Create challenge
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      return NextResponse.json(
        { error: challengeError.message },
        { status: 400 }
      );
    }

    // Verify with code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      return NextResponse.json(
        { error: 'Invalid code. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '2FA has been enabled',
    });
  } catch (error) {
    console.error('2FA Verify Error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
```

## 2FA Login Challenge

```typescript
// app/api/auth/2fa/challenge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ChallengeSchema = z.object({
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = ChallengeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }

    const { code } = result.data;
    const supabase = await createClient();

    // Get user's enrolled factors
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp[0];

    if (!totpFactor) {
      return NextResponse.json(
        { error: '2FA not enrolled' },
        { status: 400 }
      );
    }

    // Create and verify challenge
    const { data: challenge } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });

    const { error } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge!.id,
      code,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('2FA Challenge Error:', error);
    return NextResponse.json(
      { error: 'Challenge failed' },
      { status: 500 }
    );
  }
}
```

## 2FA Setup Component

```typescript
// components/TwoFactorSetup.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TwoFactorSetup() {
  const [step, setStep] = useState<'init' | 'verify' | 'done'>('init');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/enroll', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setFactorId(data.factorId);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center p-6 bg-green-50 rounded-lg">
        <h3 className="font-semibold text-green-800">2FA Enabled!</h3>
        <p className="text-green-600 mt-2">
          Your account is now protected with two-factor authentication.
        </p>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="font-semibold mb-4">Scan QR Code</h3>
          <img src={qrCode} alt="2FA QR Code" className="mx-auto" />
          <p className="text-sm text-gray-500 mt-2">
            Or enter manually: <code className="bg-gray-100 px-2 py-1">{secret}</code>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Enter code from authenticator app
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            maxLength={6}
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button onClick={handleVerify} disabled={loading || code.length !== 6}>
          {loading ? 'Verifying...' : 'Verify and Enable'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Enable Two-Factor Authentication</h3>
      <p className="text-gray-600">
        Add an extra layer of security to your account using an authenticator app.
      </p>
      <Button onClick={handleEnroll} disabled={loading}>
        {loading ? 'Setting up...' : 'Set Up 2FA'}
      </Button>
    </div>
  );
}
```

## Test

```typescript
// app/api/auth/2fa/enroll/route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '123' } },
        error: null,
      }),
      mfa: {
        enroll: vi.fn().mockResolvedValue({
          data: {
            id: 'factor-123',
            totp: {
              qr_code: 'data:image/png;base64,abc',
              secret: 'JBSWY3DPEHPK3PXP',
              uri: 'otpauth://totp/App:user@example.com',
            },
          },
          error: null,
        }),
      },
    },
  }),
}));

describe('POST /api/auth/2fa/enroll', () => {
  it('returns QR code and secret for authenticated user', async () => {
    const req = new Request('http://test/api/auth/2fa/enroll', { method: 'POST' });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.qrCode).toBeDefined();
    expect(data.secret).toBeDefined();
  });
});
```

## Usage
Use for high-security accounts. Recommend authenticator apps like Google Authenticator or Authy.
