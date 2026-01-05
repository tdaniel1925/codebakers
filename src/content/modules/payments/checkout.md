# Stripe Checkout

> Copy-paste ready. One-time payments and checkout sessions.

## Dependencies

```bash
npm install stripe @stripe/stripe-js
```

## Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Create Checkout Session API

```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const CheckoutSchema = z.object({
  priceId: z.string(),
  quantity: z.number().min(1).default(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = CheckoutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: result.error.issues },
        { status: 400 }
      );
    }

    const { priceId, quantity, successUrl, cancelUrl } = result.data;
    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      success_url: successUrl || `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${origin}/checkout/cancel`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

## Checkout Button Component

```typescript
// components/checkout-button.tsx
'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutButtonProps {
  priceId: string;
  quantity?: number;
  children: React.ReactNode;
}

export function CheckoutButton({ priceId, quantity = 1, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, quantity }),
      });

      const { sessionId } = await res.json();

      const stripe = await stripePromise;
      await stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

## Success Page

```typescript
// app/checkout/success/page.tsx
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect('/');
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);

  return (
    <div className="max-w-md mx-auto p-8 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
      <p className="text-gray-600 mb-4">
        Thank you for your purchase. Order #{session.id.slice(-8)}
      </p>
      <p className="text-sm text-gray-500">
        A confirmation email has been sent to {session.customer_details?.email}
      </p>
    </div>
  );
}
```

## Pricing Page

```typescript
// app/pricing/page.tsx
import { CheckoutButton } from '@/components/checkout-button';

const plans = [
  {
    name: 'Starter',
    price: '$9',
    priceId: 'price_starter_xxx',
    features: ['5 Projects', 'Basic Support', '1GB Storage'],
  },
  {
    name: 'Pro',
    price: '$29',
    priceId: 'price_pro_xxx',
    features: ['Unlimited Projects', 'Priority Support', '10GB Storage'],
    popular: true,
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Pricing</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`border rounded-lg p-6 ${
              plan.popular ? 'border-blue-600 ring-2 ring-blue-600' : ''
            }`}
          >
            {plan.popular && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                Popular
              </span>
            )}
            <h2 className="text-xl font-bold mt-2">{plan.name}</h2>
            <p className="text-3xl font-bold my-4">{plan.price}</p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <CheckoutButton priceId={plan.priceId}>
              Get Started
            </CheckoutButton>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Test

```typescript
// app/api/checkout/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/xxx',
        }),
      },
    },
  })),
}));

describe('Checkout API', () => {
  it('creates checkout session', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId: 'price_xxx' }),
    });

    const res = await POST(req as any);
    const data = await res.json();

    expect(data.sessionId).toBe('cs_test_123');
  });

  it('validates input', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
```

## Usage
Create prices in Stripe Dashboard. Use priceId in CheckoutButton. Handle success via webhook.
