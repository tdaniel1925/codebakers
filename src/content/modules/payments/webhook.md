# Stripe Webhooks

> Copy-paste ready. Handle Stripe events securely.

## Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { db, users, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
```

## Event Handlers

```typescript
// lib/webhooks/stripe-handlers.ts
import Stripe from 'stripe';
import { db, users, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') {
    // Handle one-time payment
    console.log('One-time payment completed:', session.id);
    return;
  }

  // Subscription is created via customer.subscription.created event
  console.log('Subscription checkout completed:', session.id);
}

export async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;

  // Upsert subscription
  await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status: subscription.status,
        stripePriceId: priceId,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

  console.log('Subscription updated:', subscription.id, subscription.status);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({ status: 'canceled' })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  console.log('Subscription canceled:', subscription.id);
}

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded for invoice:', invoice.id);

  // Optional: Send receipt email
  // await sendReceiptEmail(invoice);
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id);

  const customerId = invoice.customer as string;

  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });

  if (user) {
    // Optional: Notify user about failed payment
    // await sendPaymentFailedEmail(user.email, invoice);
  }
}
```

## Webhook Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed
```

## Webhook Signature Verification

```typescript
// Important: Get raw body for signature verification
// In Next.js App Router, req.text() gives you the raw body

// For Pages Router:
export const config = {
  api: {
    bodyParser: false, // Disable body parsing for webhook routes
  },
};

// Then use buffer to get raw body
import { buffer } from 'micro';

export default async function handler(req, res) {
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  const event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  // ...
}
```

## Idempotency Handling

```typescript
// lib/webhooks/idempotency.ts
import { db, webhookEvents } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function processEventOnce(
  eventId: string,
  handler: () => Promise<void>
): Promise<boolean> {
  // Check if already processed
  const existing = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.stripeEventId, eventId),
  });

  if (existing) {
    console.log('Event already processed:', eventId);
    return false;
  }

  // Mark as processing
  await db.insert(webhookEvents).values({
    stripeEventId: eventId,
    processedAt: new Date(),
  });

  // Process the event
  await handler();

  return true;
}

// Usage:
// await processEventOnce(event.id, async () => {
//   await handleSubscriptionChange(subscription);
// });
```

## Test

```typescript
// app/api/webhooks/stripe/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn(),
    },
  })),
}));

describe('Stripe Webhook', () => {
  it('rejects invalid signature', async () => {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe('sk_test');

    (stripe.webhooks.constructEvent as any).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    // Test webhook handler
    // ...
  });

  it('handles subscription created event', async () => {
    // Mock the event
    const event = {
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_xxx' } }] },
          current_period_start: Date.now() / 1000,
          current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60,
          cancel_at_period_end: false,
        },
      },
    };

    // Test handler
    // ...
  });
});
```

## Usage
Set STRIPE_WEBHOOK_SECRET from Stripe Dashboard. Use Stripe CLI for local testing. Handle events idempotently.
