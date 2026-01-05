# Stripe Refunds

> Copy-paste ready. Process refunds programmatically.

## Refund API

```typescript
// app/api/refunds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { db, orders } from '@/lib/db';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const RefundSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  amount: z.number().positive().optional(), // Partial refund in cents
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = RefundSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: result.error.issues },
        { status: 400 }
      );
    }

    const { orderId, reason, amount } = result.data;

    // Get the order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!order.stripePaymentIntentId) {
      return NextResponse.json(
        { error: 'No payment found for this order' },
        { status: 400 }
      );
    }

    // Create the refund
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount, // Omit for full refund
      reason,
    });

    // Update order status
    await db
      .update(orders)
      .set({
        status: amount ? 'partially_refunded' : 'refunded',
        refundedAt: new Date(),
        refundAmount: amount || order.total,
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    });
  } catch (error) {
    console.error('Refund Error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
```

## Admin Refund Form

```typescript
// components/admin/refund-form.tsx
'use client';

import { useState } from 'react';

interface RefundFormProps {
  orderId: string;
  maxAmount: number; // in cents
  onSuccess?: () => void;
}

export function RefundForm({ orderId, maxAmount, onSuccess }: RefundFormProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState<string>('requested_by_customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reason,
          amount: amount ? amount * 100 : undefined, // Convert to cents
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Refund failed');
      }

      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Refund Amount</label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">$</span>
          <input
            type="number"
            step="0.01"
            max={maxAmount / 100}
            placeholder={`Full refund: ${(maxAmount / 100).toFixed(2)}`}
            value={amount || ''}
            onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : null)}
            className="flex-1 border rounded px-3 py-2"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Leave empty for full refund
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="requested_by_customer">Customer Request</option>
          <option value="duplicate">Duplicate Charge</option>
          <option value="fraudulent">Fraudulent</option>
        </select>
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Process Refund'}
      </button>
    </form>
  );
}
```

## Handle Refund Webhooks

```typescript
// In your webhook handler, add these cases:

case 'charge.refunded':
  await handleRefund(event.data.object as Stripe.Charge);
  break;

case 'charge.refund.updated':
  await handleRefundUpdate(event.data.object as Stripe.Refund);
  break;

// lib/webhooks/refund-handlers.ts
export async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  // Find order by payment intent
  const order = await db.query.orders.findFirst({
    where: eq(orders.stripePaymentIntentId, paymentIntentId),
  });

  if (!order) return;

  const totalRefunded = charge.amount_refunded;
  const isFullRefund = totalRefunded >= charge.amount;

  await db
    .update(orders)
    .set({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      refundAmount: totalRefunded,
      refundedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // Optional: Send refund confirmation email
  // await sendRefundEmail(order.userEmail, totalRefunded / 100);
}
```

## Refund Policy Component

```typescript
// components/refund-request.tsx
'use client';

import { useState } from 'react';

interface RefundRequestProps {
  orderId: string;
  orderDate: Date;
  refundWindowDays?: number;
}

export function RefundRequest({
  orderId,
  orderDate,
  refundWindowDays = 30,
}: RefundRequestProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const daysSinceOrder = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const canRequestRefund = daysSinceOrder <= refundWindowDays;

  async function handleRequest() {
    setLoading(true);

    try {
      await fetch('/api/refund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      setSubmitted(true);
    } catch (error) {
      alert('Failed to submit request');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-green-50 text-green-800 rounded">
        Refund request submitted. We'll review within 1-2 business days.
      </div>
    );
  }

  if (!canRequestRefund) {
    return (
      <div className="p-4 bg-gray-50 text-gray-600 rounded">
        Refund window has expired ({refundWindowDays} days from purchase).
      </div>
    );
  }

  return (
    <div className="p-4 border rounded">
      <p className="mb-4">
        You have {refundWindowDays - daysSinceOrder} days left to request a refund.
      </p>
      <button
        onClick={handleRequest}
        disabled={loading}
        className="bg-gray-800 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Request Refund'}
      </button>
    </div>
  );
}
```

## Test

```typescript
// app/api/refunds/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    refunds: {
      create: vi.fn().mockResolvedValue({
        id: 're_123',
        amount: 1000,
        status: 'succeeded',
      }),
    },
  })),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-123', role: 'admin' }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'order-123',
          userId: 'user-123',
          stripePaymentIntentId: 'pi_123',
          total: 1000,
        }),
      },
    },
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
  orders: {},
}));

describe('Refund API', () => {
  it('processes full refund', async () => {
    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-123' }),
    });

    const res = await POST(req as any);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.refundId).toBe('re_123');
  });

  it('validates order ownership', async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    (getCurrentUser as any).mockResolvedValueOnce({ id: 'other-user', role: 'user' });

    const { POST } = await import('./route');

    const req = new Request('http://localhost/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-123' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });
});
```

## Usage
Refunds take 5-10 business days to appear. Store refund status in database. Handle webhook for confirmation.
