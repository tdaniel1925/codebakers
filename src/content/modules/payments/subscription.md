# Stripe Subscriptions

> Copy-paste ready. Recurring payments with Stripe.

## Database Schema

```typescript
// lib/db/schema.ts
import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status').notNull(), // active, canceled, past_due, etc.
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

## Create Subscription API

```typescript
// app/api/subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
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

    const { priceId } = await req.json();

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Subscription Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
```

## Cancel Subscription API

```typescript
// app/api/subscriptions/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';
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

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Cancel at period end (user keeps access until end of billing period)
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(subscriptions.id, subscription.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
```

## Check Subscription Status

```typescript
// lib/subscription.ts
import { db, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function getSubscription(userId: string) {
  return db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
}

export async function isSubscribed(userId: string): Promise<boolean> {
  const subscription = await getSubscription(userId);
  return subscription?.status === 'active';
}

export async function getSubscriptionTier(userId: string): Promise<string> {
  const subscription = await getSubscription(userId);

  if (!subscription || subscription.status !== 'active') {
    return 'free';
  }

  // Map price IDs to tiers
  const tierMap: Record<string, string> = {
    'price_starter_xxx': 'starter',
    'price_pro_xxx': 'pro',
    'price_enterprise_xxx': 'enterprise',
  };

  return tierMap[subscription.stripePriceId] || 'free';
}
```

## Subscription Guard

```typescript
// lib/guards/subscription-guard.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isSubscribed } from '@/lib/subscription';

export async function requireSubscription(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasSubscription = await isSubscribed(user.id);

  if (!hasSubscription) {
    return NextResponse.json(
      { error: 'Subscription required', upgrade: '/pricing' },
      { status: 403 }
    );
  }

  return null; // Continue to handler
}

// Usage in API route:
// export async function POST(req: NextRequest) {
//   const guard = await requireSubscription(req);
//   if (guard) return guard;
//   // ... rest of handler
// }
```

## Billing Page Component

```typescript
// app/settings/billing/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { getSubscription } from '@/lib/subscription';
import { redirect } from 'next/navigation';
import { SubscribeButton } from './subscribe-button';
import { CancelButton } from './cancel-button';
import { PortalButton } from './portal-button';

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const subscription = await getSubscription(user.id);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      {subscription?.status === 'active' ? (
        <div className="border rounded-lg p-6">
          <h2 className="font-semibold mb-2">Current Plan</h2>
          <p className="text-gray-600 mb-4">
            {subscription.cancelAtPeriodEnd
              ? `Cancels on ${subscription.currentPeriodEnd?.toLocaleDateString()}`
              : `Renews on ${subscription.currentPeriodEnd?.toLocaleDateString()}`}
          </p>
          <div className="flex gap-4">
            <PortalButton />
            {!subscription.cancelAtPeriodEnd && <CancelButton />}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-6 text-center">
          <h2 className="font-semibold mb-2">No Active Subscription</h2>
          <p className="text-gray-600 mb-4">
            Subscribe to unlock premium features
          </p>
          <SubscribeButton priceId="price_pro_xxx">
            Subscribe Now
          </SubscribeButton>
        </div>
      )}
    </div>
  );
}
```

## Test

```typescript
// lib/subscription.test.ts
import { describe, it, expect, vi } from 'vitest';
import { isSubscribed, getSubscriptionTier } from './subscription';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      subscriptions: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('Subscription', () => {
  it('returns false for no subscription', async () => {
    const { db } = await import('@/lib/db');
    (db.query.subscriptions.findFirst as any).mockResolvedValueOnce(null);

    const result = await isSubscribed('user-123');
    expect(result).toBe(false);
  });

  it('returns true for active subscription', async () => {
    const { db } = await import('@/lib/db');
    (db.query.subscriptions.findFirst as any).mockResolvedValueOnce({
      status: 'active',
    });

    const result = await isSubscribed('user-123');
    expect(result).toBe(true);
  });

  it('returns correct tier', async () => {
    const { db } = await import('@/lib/db');
    (db.query.subscriptions.findFirst as any).mockResolvedValueOnce({
      status: 'active',
      stripePriceId: 'price_pro_xxx',
    });

    const tier = await getSubscriptionTier('user-123');
    expect(tier).toBe('pro');
  });
});
```

## Usage
Store stripeCustomerId on user. Sync subscription status via webhooks. Check tier before premium features.
