# Stripe Customer Portal

> Copy-paste ready. Let customers manage billing themselves.

## Create Portal Session API

```typescript
// app/api/billing/portal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal Error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
```

## Portal Button Component

```typescript
// components/portal-button.tsx
'use client';

import { useState } from 'react';

export function PortalButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      const { url, error } = await res.json();

      if (error) {
        alert(error);
        return;
      }

      window.location.href = url;
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? 'Loading...' : 'Manage Billing'}
    </button>
  );
}
```

## Configure Portal in Stripe Dashboard

Before using the Customer Portal, configure it in Stripe Dashboard:

1. Go to **Settings > Billing > Customer Portal**
2. Enable features:
   - Update payment methods
   - View invoice history
   - Cancel subscriptions
   - Update billing information
3. Customize branding to match your app
4. Set allowed subscription changes

## Portal with Return URL Parameter

```typescript
// app/api/billing/portal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`;

    // Validate return URL is from our domain
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL!);
    const requestedUrl = new URL(returnUrl, process.env.NEXT_PUBLIC_APP_URL);

    if (requestedUrl.host !== appUrl.host) {
      return NextResponse.json({ error: 'Invalid return URL' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal Error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
```

## Portal with Flow Configuration

```typescript
// Direct users to specific portal sections
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: returnUrl,
  flow_data: {
    type: 'payment_method_update',
    // Or 'subscription_cancel', 'subscription_update'
  },
});
```

## Billing Settings Page

```typescript
// app/settings/billing/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { getSubscription } from '@/lib/subscription';
import { redirect } from 'next/navigation';
import { PortalButton } from '@/components/portal-button';

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const subscription = await getSubscription(user.id);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Billing Settings</h1>

      {subscription ? (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Current Plan</h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-medium">Pro Plan</p>
                <p className="text-gray-600">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels ${subscription.currentPeriodEnd?.toLocaleDateString()}`
                    : `Renews ${subscription.currentPeriodEnd?.toLocaleDateString()}`}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                subscription.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {subscription.status}
              </span>
            </div>
          </div>

          {/* Portal Access */}
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-2">Manage Subscription</h2>
            <p className="text-gray-600 mb-4">
              Update payment method, view invoices, or cancel subscription.
            </p>
            <PortalButton />
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">No active subscription</p>
          <a
            href="/pricing"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  );
}
```

## Test

```typescript
// app/api/billing/portal/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          url: 'https://billing.stripe.com/session/xxx',
        }),
      },
    },
  })),
}));

describe('Billing Portal API', () => {
  it('returns portal URL for authenticated user', async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    (getCurrentUser as any).mockResolvedValueOnce({
      id: 'user-123',
      stripeCustomerId: 'cus_123',
    });

    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/billing/portal', {
      method: 'POST',
    });

    const res = await POST(req as any);
    const data = await res.json();

    expect(data.url).toContain('stripe.com');
  });

  it('rejects unauthenticated request', async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    (getCurrentUser as any).mockResolvedValueOnce(null);

    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/billing/portal', {
      method: 'POST',
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
```

## Usage
Configure portal in Stripe Dashboard first. Customers can update cards, cancel, and view invoices. No custom UI needed.
