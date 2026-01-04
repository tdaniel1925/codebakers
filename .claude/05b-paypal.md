# PAYMENTS (PAYPAL)
# Module: 05b-paypal.md
# Load with: 00-core.md
# Related: 05-payments.md (Stripe patterns - webhook structure is similar)

---

## When to Use This Pattern

Use this when:
- Accepting PayPal payments (subscriptions or one-time)
- Need broader international payment coverage
- Users prefer PayPal over entering card details
- Building marketplace with PayPal payouts

Don't use this when:
- Stripe-only is sufficient (see 05-payments.md)
- Need advanced billing features (Stripe is more flexible)

---

## 💳 PAYPAL INTEGRATION

### PayPal Server Setup

```typescript
// lib/paypal/server.ts
import fetch from 'node-fetch';

if (!process.env.PAYPAL_CLIENT_ID) {
  throw new Error('PAYPAL_CLIENT_ID is not set');
}
if (!process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error('PAYPAL_CLIENT_SECRET is not set');
}

const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Cache access token (expires in ~9 hours)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal auth failed: ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  // Cache with 5-minute buffer
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

// Plan IDs from your PayPal dashboard
export const PAYPAL_PLANS = {
  PRO_MONTHLY: process.env.PAYPAL_PRO_MONTHLY_PLAN_ID!,
  PRO_YEARLY: process.env.PAYPAL_PRO_YEARLY_PLAN_ID!,
  TEAM_MONTHLY: process.env.PAYPAL_TEAM_MONTHLY_PLAN_ID!,
  TEAM_YEARLY: process.env.PAYPAL_TEAM_YEARLY_PLAN_ID!,
} as const;

export type PayPalPlanId = (typeof PAYPAL_PLANS)[keyof typeof PAYPAL_PLANS];
export { PAYPAL_BASE_URL };
```

---

## 💼 PAYPAL SERVICE

```typescript
// services/paypal-service.ts
import { getPayPalAccessToken, PAYPAL_BASE_URL, PAYPAL_PLANS } from '@/lib/paypal/server';
import { db } from '@/db';
import { subscriptions, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface CreateSubscriptionOptions {
  teamId: string;
  planId: string;
  userId: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
}

interface PayPalSubscription {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

export class PayPalService {
  /**
   * Create a subscription and return the approval URL
   */
  static async createSubscription(options: CreateSubscriptionOptions): Promise<string> {
    const { teamId, planId, userId, email, returnUrl, cancelUrl } = options;
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `sub_${teamId}_${Date.now()}`, // Idempotency key
      },
      body: JSON.stringify({
        plan_id: planId,
        subscriber: {
          email_address: email,
        },
        application_context: {
          brand_name: 'YourApp',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
        custom_id: teamId, // Store teamId for webhook reference
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('PayPal subscription creation failed:', error);
      throw new Error('Failed to create PayPal subscription');
    }

    const subscription = await response.json() as PayPalSubscription;

    // Find the approval URL
    const approvalLink = subscription.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      throw new Error('No approval URL in PayPal response');
    }

    // Store pending subscription
    await db.insert(subscriptions).values({
      teamId,
      provider: 'paypal',
      providerSubscriptionId: subscription.id,
      status: 'pending',
      planId,
      createdBy: userId,
    }).onConflictDoUpdate({
      target: [subscriptions.teamId],
      set: {
        provider: 'paypal',
        providerSubscriptionId: subscription.id,
        status: 'pending',
        planId,
        updatedAt: new Date(),
      },
    });

    return approvalLink.href;
  }

  /**
   * Get subscription details
   */
  static async getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get PayPal subscription');
    }

    return response.json() as Promise<PayPalSubscription>;
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Customer requested cancellation',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('PayPal cancellation failed:', error);
      throw new Error('Failed to cancel PayPal subscription');
    }

    // Update database
    await db.update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.providerSubscriptionId, subscriptionId));
  }

  /**
   * Suspend a subscription (pause billing)
   */
  static async suspendSubscription(subscriptionId: string, reason?: string): Promise<void> {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/suspend`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Customer requested pause',
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to suspend PayPal subscription');
    }
  }

  /**
   * Reactivate a suspended subscription
   */
  static async activateSubscription(subscriptionId: string): Promise<void> {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/activate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Reactivating subscription',
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to activate PayPal subscription');
    }
  }
}
```

---

## 🔔 WEBHOOK HANDLING

### Webhook Signature Verification

```typescript
// lib/paypal/verify-webhook.ts
import { getPayPalAccessToken, PAYPAL_BASE_URL } from './server';

interface WebhookVerificationParams {
  webhookId: string;
  headers: {
    'paypal-transmission-id': string;
    'paypal-transmission-time': string;
    'paypal-cert-url': string;
    'paypal-auth-algo': string;
    'paypal-transmission-sig': string;
  };
  body: string; // Raw request body
}

export async function verifyPayPalWebhook(params: WebhookVerificationParams): Promise<boolean> {
  const { webhookId, headers, body } = params;
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    }
  );

  if (!response.ok) {
    console.error('PayPal webhook verification request failed');
    return false;
  }

  const result = await response.json() as { verification_status: string };
  return result.verification_status === 'SUCCESS';
}
```

### Webhook Route Handler

```typescript
// app/api/webhooks/paypal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhook } from '@/lib/paypal/verify-webhook';
import { db } from '@/db';
import { subscriptions, teams, webhookEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

// MUST be raw body for signature verification
export const dynamic = 'force-dynamic';

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID!;

// PayPal subscription webhook event types
type PayPalEventType =
  | 'BILLING.SUBSCRIPTION.ACTIVATED'
  | 'BILLING.SUBSCRIPTION.CANCELLED'
  | 'BILLING.SUBSCRIPTION.SUSPENDED'
  | 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
  | 'PAYMENT.SALE.COMPLETED'
  | 'PAYMENT.SALE.REFUNDED';

interface PayPalWebhookEvent {
  id: string;
  event_type: PayPalEventType;
  resource: {
    id: string;
    custom_id?: string; // Our teamId
    status?: string;
    billing_info?: {
      next_billing_time?: string;
    };
  };
  create_time: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Extract PayPal headers
    const headers = {
      'paypal-transmission-id': req.headers.get('paypal-transmission-id') || '',
      'paypal-transmission-time': req.headers.get('paypal-transmission-time') || '',
      'paypal-cert-url': req.headers.get('paypal-cert-url') || '',
      'paypal-auth-algo': req.headers.get('paypal-auth-algo') || '',
      'paypal-transmission-sig': req.headers.get('paypal-transmission-sig') || '',
    };

    // Verify webhook signature
    const isValid = await verifyPayPalWebhook({
      webhookId: PAYPAL_WEBHOOK_ID,
      headers,
      body,
    });

    if (!isValid) {
      console.error('Invalid PayPal webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body) as PayPalWebhookEvent;

    // Log webhook for debugging
    await db.insert(webhookEvents).values({
      provider: 'paypal',
      eventId: event.id,
      eventType: event.event_type,
      payload: body,
      processedAt: new Date(),
    }).catch(() => {}); // Non-critical, ignore errors

    // Handle different event types
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await handlePaymentFailed(event);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event);
        break;

      case 'PAYMENT.SALE.REFUNDED':
        await handlePaymentRefunded(event);
        break;

      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionActivated(event: PayPalWebhookEvent) {
  const subscriptionId = event.resource.id;
  const teamId = event.resource.custom_id;

  if (!teamId) {
    console.error('No teamId in PayPal subscription');
    return;
  }

  await db.update(subscriptions)
    .set({
      status: 'active',
      currentPeriodEnd: event.resource.billing_info?.next_billing_time
        ? new Date(event.resource.billing_info.next_billing_time)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.providerSubscriptionId, subscriptionId));

  // Update team status
  await db.update(teams)
    .set({
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

async function handleSubscriptionCancelled(event: PayPalWebhookEvent) {
  const subscriptionId = event.resource.id;

  await db.update(subscriptions)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.providerSubscriptionId, subscriptionId));
}

async function handleSubscriptionSuspended(event: PayPalWebhookEvent) {
  const subscriptionId = event.resource.id;

  await db.update(subscriptions)
    .set({
      status: 'suspended',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.providerSubscriptionId, subscriptionId));
}

async function handlePaymentFailed(event: PayPalWebhookEvent) {
  const subscriptionId = event.resource.id;

  await db.update(subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.providerSubscriptionId, subscriptionId));

  // TODO: Send payment failed email to customer
}

async function handlePaymentCompleted(event: PayPalWebhookEvent) {
  // Update last payment date, could also store transaction history
  console.log('PayPal payment completed:', event.resource.id);
}

async function handlePaymentRefunded(event: PayPalWebhookEvent) {
  // Handle refund - might need to revoke access
  console.log('PayPal payment refunded:', event.resource.id);
  // TODO: Implement refund handling based on business logic
}
```

---

## 🛒 ONE-TIME PAYMENTS (Orders API)

```typescript
// services/paypal-orders-service.ts
import { getPayPalAccessToken, PAYPAL_BASE_URL } from '@/lib/paypal/server';

interface CreateOrderOptions {
  amount: string; // e.g., "99.99"
  currency: string; // e.g., "USD"
  description: string;
  customId?: string;
  returnUrl: string;
  cancelUrl: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

export class PayPalOrdersService {
  /**
   * Create a one-time payment order
   */
  static async createOrder(options: CreateOrderOptions): Promise<string> {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: options.currency,
              value: options.amount,
            },
            description: options.description,
            custom_id: options.customId,
          },
        ],
        application_context: {
          brand_name: 'YourApp',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: options.returnUrl,
          cancel_url: options.cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create PayPal order');
    }

    const order = await response.json() as PayPalOrder;
    const approvalLink = order.links.find(link => link.rel === 'approve');

    if (!approvalLink) {
      throw new Error('No approval URL in PayPal order');
    }

    return approvalLink.href;
  }

  /**
   * Capture payment after user approval
   */
  static async captureOrder(orderId: string): Promise<{ success: boolean; transactionId?: string }> {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('PayPal capture failed:', error);
      return { success: false };
    }

    const result = await response.json() as {
      id: string;
      status: string;
      purchase_units: Array<{
        payments: {
          captures: Array<{ id: string }>;
        };
      }>;
    };

    if (result.status !== 'COMPLETED') {
      return { success: false };
    }

    const transactionId = result.purchase_units[0]?.payments?.captures[0]?.id;
    return { success: true, transactionId };
  }
}
```

---

## 🔗 API ROUTES

### Create Subscription Route

```typescript
// app/api/paypal/create-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PayPalService } from '@/services/paypal-service';
import { PAYPAL_PLANS } from '@/lib/paypal/server';
import { z } from 'zod';

const CreateSubscriptionSchema = z.object({
  planKey: z.enum(['pro_monthly', 'pro_yearly', 'team_monthly', 'team_yearly']),
  teamId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { planKey, teamId } = CreateSubscriptionSchema.parse(body);

    // Map plan key to PayPal plan ID
    const planIdMap: Record<string, string> = {
      pro_monthly: PAYPAL_PLANS.PRO_MONTHLY,
      pro_yearly: PAYPAL_PLANS.PRO_YEARLY,
      team_monthly: PAYPAL_PLANS.TEAM_MONTHLY,
      team_yearly: PAYPAL_PLANS.TEAM_YEARLY,
    };

    const planId = planIdMap[planKey];
    if (!planId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const approvalUrl = await PayPalService.createSubscription({
      teamId,
      planId,
      userId: session.user.id,
      email: session.user.email,
      returnUrl: `${baseUrl}/billing/success?provider=paypal`,
      cancelUrl: `${baseUrl}/billing/cancelled`,
    });

    return NextResponse.json({ approvalUrl });
  } catch (error) {
    console.error('PayPal subscription creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
```

---

## 📋 ENVIRONMENT VARIABLES

```bash
# .env.local

# PayPal API Credentials
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret

# PayPal Webhook ID (from PayPal Developer Dashboard)
PAYPAL_WEBHOOK_ID=your_webhook_id

# PayPal Plan IDs (create these in PayPal Dashboard)
PAYPAL_PRO_MONTHLY_PLAN_ID=P-xxx
PAYPAL_PRO_YEARLY_PLAN_ID=P-xxx
PAYPAL_TEAM_MONTHLY_PLAN_ID=P-xxx
PAYPAL_TEAM_YEARLY_PLAN_ID=P-xxx
```

---

## ⚠️ COMMON ISSUES & SOLUTIONS

### Issue: Webhook signature verification fails
```typescript
// MUST use raw body, not parsed JSON
const body = await req.text(); // ✅ Correct
// const body = await req.json(); // ❌ Wrong - breaks signature
```

### Issue: Subscription not found in webhook
```typescript
// Store teamId in custom_id when creating subscription
custom_id: teamId, // ✅ Use this to link back to your data
```

### Issue: Token expired during long operations
```typescript
// Token caching handles this, but for safety:
try {
  await PayPalService.someOperation();
} catch (error) {
  if (error.message.includes('401')) {
    // Clear cache and retry
    cachedToken = null;
    await PayPalService.someOperation();
  }
}
```

---

## 🧪 TESTING

### Test Accounts
PayPal Sandbox provides test buyer/seller accounts:
1. Go to PayPal Developer Dashboard
2. Create sandbox accounts
3. Use sandbox credentials in development

### Test Card Numbers
In sandbox, use these test cards:
- Visa: 4111111111111111
- Mastercard: 5555555555554444

### Webhook Testing
Use PayPal's webhook simulator:
1. Developer Dashboard → Webhooks
2. Select your webhook
3. "Simulate Events" to test handlers
