# PAYMENTS (STRIPE)
# Module: 05-payments.md
# Load with: 00-core.md

---

## 💳 STRIPE INTEGRATION

### Stripe Server Setup

```typescript
// lib/stripe/server.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
  maxNetworkRetries: 2,
});

// Price IDs from your Stripe dashboard
export const STRIPE_PRICES = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  PRO_YEARLY: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  TEAM_MONTHLY: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!,
  TEAM_YEARLY: process.env.STRIPE_TEAM_YEARLY_PRICE_ID!,
  AGENCY_MONTHLY: process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID!,
  AGENCY_YEARLY: process.env.STRIPE_AGENCY_YEARLY_PRICE_ID!,
} as const;

export type PriceId = (typeof STRIPE_PRICES)[keyof typeof STRIPE_PRICES];

// Plan configuration
export const PLANS = {
  free: {
    name: 'Free',
    description: 'For trying out',
    priceMonthly: 0,
    priceYearly: 0,
    features: ['1 project', 'Basic features', 'Community support'],
    limits: { projects: 1, seats: 1, apiCalls: 100 },
  },
  pro: {
    name: 'Pro',
    description: 'For individuals',
    priceMonthly: 49,
    priceYearly: 470,
    stripePriceIdMonthly: STRIPE_PRICES.PRO_MONTHLY,
    stripePriceIdYearly: STRIPE_PRICES.PRO_YEARLY,
    features: ['Unlimited projects', 'All features', 'Email support', 'Priority updates'],
    limits: { projects: -1, seats: 1, apiCalls: 10000 },
  },
  team: {
    name: 'Team',
    description: 'For small teams',
    priceMonthly: 149,
    priceYearly: 1430,
    stripePriceIdMonthly: STRIPE_PRICES.TEAM_MONTHLY,
    stripePriceIdYearly: STRIPE_PRICES.TEAM_YEARLY,
    features: ['Everything in Pro', '5 team seats', 'Team management', 'Priority support'],
    limits: { projects: -1, seats: 5, apiCalls: 50000 },
  },
  agency: {
    name: 'Agency',
    description: 'For agencies',
    priceMonthly: 349,
    priceYearly: 3350,
    stripePriceIdMonthly: STRIPE_PRICES.AGENCY_MONTHLY,
    stripePriceIdYearly: STRIPE_PRICES.AGENCY_YEARLY,
    features: ['Everything in Team', 'Unlimited seats', 'White-label', 'Dedicated support'],
    limits: { projects: -1, seats: -1, apiCalls: -1 },
  },
} as const;

export type PlanKey = keyof typeof PLANS;
```

---

## 💼 STRIPE SERVICE

```typescript
// services/stripe-service.ts
import { stripe, STRIPE_PRICES, PLANS, PlanKey } from '@/lib/stripe/server';
import { db } from '@/db';
import { subscriptions, teams, profiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface CheckoutOptions {
  teamId: string;
  priceId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  couponId?: string;
  metadata?: Record<string, string>;
}

interface PortalOptions {
  customerId: string;
  returnUrl: string;
  flowType?: 'subscription_cancel' | 'subscription_update' | 'payment_method_update';
}

export class StripeService {
  /**
   * Create or retrieve Stripe customer
   */
  static async getOrCreateCustomer(
    teamId: string,
    email: string,
    name?: string
  ): Promise<string> {
    // Check existing customer
    const [team] = await db
      .select({ stripeCustomerId: teams.stripeCustomerId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team?.stripeCustomerId) {
      // Verify customer still exists in Stripe
      try {
        await stripe.customers.retrieve(team.stripeCustomerId);
        return team.stripeCustomerId;
      } catch (error) {
        // Customer deleted in Stripe, create new one
      }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      metadata: { teamId },
    });

    // Save customer ID
    await db
      .update(teams)
      .set({ 
        stripeCustomerId: customer.id,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    return customer.id;
  }

  /**
   * Create checkout session for subscription
   */
  static async createCheckoutSession(options: CheckoutOptions) {
    const {
      teamId,
      priceId,
      userId,
      email,
      successUrl,
      cancelUrl,
      trialDays,
      couponId,
      metadata = {},
    } = options;

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(teamId, email);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      metadata: {
        teamId,
        userId,
        ...metadata,
      },
      subscription_data: {
        metadata: { teamId, userId },
      },
    };

    // Add trial if specified
    if (trialDays && trialDays > 0) {
      sessionParams.subscription_data!.trial_period_days = trialDays;
    }

    // Add coupon if specified
    if (couponId) {
      sessionParams.discounts = [{ coupon: couponId }];
      delete sessionParams.allow_promotion_codes;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return session;
  }

  /**
   * Create one-time payment checkout
   */
  static async createOneTimeCheckout(options: {
    teamId: string;
    email: string;
    lineItems: Array<{ priceId: string; quantity: number }>;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    const customerId = await this.getOrCreateCustomer(options.teamId, options.email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: options.lineItems.map((item) => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      success_url: `${options.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: options.cancelUrl,
      metadata: {
        teamId: options.teamId,
        ...options.metadata,
      },
    });

    return session;
  }

  /**
   * Create customer portal session
   */
  static async createPortalSession(options: PortalOptions) {
    const { customerId, returnUrl, flowType } = options;

    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: returnUrl,
    };

    // Add specific flow if requested
    if (flowType) {
      params.flow_data = {
        type: flowType,
        ...(flowType === 'subscription_cancel' && {
          subscription_cancel: {
            subscription: await this.getActiveSubscriptionId(customerId),
          },
        }),
      };
    }

    const session = await stripe.billingPortal.sessions.create(params);
    return session;
  }

  /**
   * Get active subscription ID for customer
   */
  private static async getActiveSubscriptionId(customerId: string): Promise<string> {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (!subscriptions.data[0]) {
      throw new Error('No active subscription found');
    }

    return subscriptions.data[0].id;
  }

  /**
   * Cancel subscription at period end
   */
  static async cancelSubscription(subscriptionId: string) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Resume canceled subscription
   */
  static async resumeSubscription(subscriptionId: string) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Immediately cancel subscription (no refund)
   */
  static async cancelSubscriptionImmediately(subscriptionId: string) {
    return stripe.subscriptions.cancel(subscriptionId, {
      prorate: false,
    });
  }

  /**
   * Update subscription to new plan
   */
  static async updateSubscription(
    subscriptionId: string,
    newPriceId: string,
    options?: { prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior }
  ) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: options?.prorationBehavior || 'create_prorations',
    });
  }

  /**
   * Get subscription details
   */
  static async getSubscription(subscriptionId: string) {
    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'latest_invoice'],
    });
  }

  /**
   * List customer invoices
   */
  static async listInvoices(customerId: string, limit = 10) {
    return stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ['data.subscription'],
    });
  }

  /**
   * Get upcoming invoice preview
   */
  static async getUpcomingInvoice(customerId: string, newPriceId?: string) {
    const params: Stripe.InvoiceRetrieveUpcomingParams = {
      customer: customerId,
    };

    if (newPriceId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data[0]) {
        params.subscription = subscriptions.data[0].id;
        params.subscription_items = [
          {
            id: subscriptions.data[0].items.data[0].id,
            price: newPriceId,
          },
        ];
      }
    }

    return stripe.invoices.retrieveUpcoming(params);
  }

  /**
   * Apply coupon to subscription
   */
  static async applyCoupon(subscriptionId: string, couponId: string) {
    return stripe.subscriptions.update(subscriptionId, {
      coupon: couponId,
    });
  }

  /**
   * Remove coupon from subscription
   */
  static async removeCoupon(subscriptionId: string) {
    return stripe.subscriptions.update(subscriptionId, {
      coupon: '',
    });
  }

  /**
   * Create usage record for metered billing
   */
  static async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number
  ) {
    return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  }
}
```

---

## 🪝 WEBHOOK HANDLER

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { db } from '@/db';
import { teams, subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Webhook secret from Stripe dashboard
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook verification failed';
    console.error('Stripe webhook verification failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.upcoming':
        await handleUpcomingInvoice(event.data.object as Stripe.Invoice);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    // Return 200 to acknowledge receipt (retry won't help for DB errors)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 200 }
    );
  }
}

// Helper to get plan from price ID
function getPlanFromPriceId(priceId: string): string {
  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID!]: 'pro',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID!]: 'pro',
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_TEAM_YEARLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID!]: 'agency',
    [process.env.STRIPE_AGENCY_YEARLY_PRICE_ID!]: 'agency',
  };
  return priceMap[priceId] || 'free';
}

// Helper to map Stripe status to our status
function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    trialing: 'trialing',
    paused: 'paused',
  };
  return statusMap[status] || 'inactive';
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const teamId = session.metadata?.teamId;
  if (!teamId) {
    console.error('Missing teamId in checkout session metadata');
    return;
  }

  // For subscription checkouts, the subscription handler will update the DB
  if (session.mode === 'subscription' && session.subscription) {
    // Subscription webhooks will handle the rest
    console.log(`Checkout completed for team ${teamId}, subscription ${session.subscription}`);
  }

  // For one-time payments
  if (session.mode === 'payment') {
    console.log(`One-time payment completed for team ${teamId}`);
    // Handle one-time payment logic
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const teamId = subscription.metadata?.teamId;
  if (!teamId) {
    console.error('Missing teamId in subscription metadata');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);
  const status = mapSubscriptionStatus(subscription.status);

  await db
    .update(teams)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: plan as any,
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  console.log(`Subscription created: team=${teamId}, plan=${plan}, status=${status}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const teamId = subscription.metadata?.teamId;
  if (!teamId) {
    // Try to find team by subscription ID
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.stripeSubscriptionId, subscription.id))
      .limit(1);
    
    if (!team) {
      console.error('Could not find team for subscription', subscription.id);
      return;
    }
    
    await updateTeamSubscription(team.id, subscription);
    return;
  }

  await updateTeamSubscription(teamId, subscription);
}

async function updateTeamSubscription(teamId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);
  const status = mapSubscriptionStatus(subscription.status);

  await db
    .update(teams)
    .set({
      subscriptionPlan: plan as any,
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  console.log(`Subscription updated: team=${teamId}, plan=${plan}, status=${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Find team by subscription ID
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!team) {
    console.error('Team not found for deleted subscription', subscription.id);
    return;
  }

  await db
    .update(teams)
    .set({
      subscriptionPlan: 'free' as any,
      subscriptionStatus: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(teams.id, team.id));

  console.log(`Subscription canceled: team=${team.id}`);

  // TODO: Send cancellation email
  // await sendCancellationEmail(team.id);
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const teamId = subscription.metadata?.teamId;
  if (!teamId) return;

  console.log(`Trial ending soon for team ${teamId}`);
  
  // TODO: Send trial ending email
  // await sendTrialEndingEmail(teamId, subscription.trial_end);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find team by customer ID
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  if (!team) {
    console.error('Team not found for paid invoice', customerId);
    return;
  }

  console.log(`Invoice paid: team=${team.id}, amount=${invoice.amount_paid}`);

  // TODO: Send receipt email
  // await sendReceiptEmail(team.id, invoice);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find team by customer ID
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  if (!team) {
    console.error('Team not found for failed invoice', customerId);
    return;
  }

  console.log(`Invoice payment failed: team=${team.id}`);

  // TODO: Send payment failed email
  // await sendPaymentFailedEmail(team.id, invoice);
}

async function handleUpcomingInvoice(invoice: Stripe.Invoice) {
  // Notification about upcoming payment
  console.log('Upcoming invoice:', invoice.id);
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  // Customer details updated (email, name, etc.)
  console.log('Customer updated:', customer.id);
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  // New payment method added
  console.log('Payment method attached:', paymentMethod.id);
}
```

---

## 💰 MONEY HANDLING - NEVER USE FLOATS

```typescript
// lib/money.ts

/**
 * ALWAYS store money as integers (cents)
 * 1 dollar = 100 cents
 * $19.99 = 1999 cents
 * 
 * NEVER use floats for money - they cause rounding errors!
 */

export const Money = {
  /**
   * Convert dollars to cents
   * @example Money.toCents(19.99) // 1999
   */
  toCents(dollars: number): number {
    return Math.round(dollars * 100);
  },

  /**
   * Convert cents to dollars
   * @example Money.toDollars(1999) // 19.99
   */
  toDollars(cents: number): number {
    return cents / 100;
  },

  /**
   * Format cents for display
   * @example Money.format(1999) // "$19.99"
   * @example Money.format(1999, 'EUR', 'de-DE') // "19,99 €"
   */
  format(
    cents: number,
    currency: string = 'USD',
    locale: string = 'en-US'
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  },

  /**
   * Format cents as compact string
   * @example Money.formatCompact(150000) // "$1.5K"
   */
  formatCompact(
    cents: number,
    currency: string = 'USD',
    locale: string = 'en-US'
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(cents / 100);
  },

  /**
   * Add multiple amounts (safe integer math)
   * @example Money.add(1000, 500, 250) // 1750
   */
  add(...amounts: number[]): number {
    return amounts.reduce((sum, amount) => sum + amount, 0);
  },

  /**
   * Subtract amounts
   * @example Money.subtract(1000, 250) // 750
   */
  subtract(base: number, ...amounts: number[]): number {
    return amounts.reduce((result, amount) => result - amount, base);
  },

  /**
   * Multiply with rounding
   * @example Money.multiply(1000, 0.5) // 500
   */
  multiply(cents: number, factor: number): number {
    return Math.round(cents * factor);
  },

  /**
   * Calculate percentage of amount
   * @example Money.percentage(10000, 8.25) // 825 (8.25% of $100)
   */
  percentage(cents: number, percent: number): number {
    return Math.round(cents * (percent / 100));
  },

  /**
   * Calculate tax amount
   * @example Money.calculateTax(10000, 0.0825) // 825 (8.25% tax)
   */
  calculateTax(subtotalCents: number, taxRate: number): number {
    return Math.round(subtotalCents * taxRate);
  },

  /**
   * Add tax to subtotal
   * @example Money.addTax(10000, 0.0825) // 10825
   */
  addTax(subtotalCents: number, taxRate: number): number {
    return subtotalCents + this.calculateTax(subtotalCents, taxRate);
  },

  /**
   * Extract tax from tax-inclusive price
   * @example Money.extractTax(10825, 0.0825) // { subtotal: 10000, tax: 825 }
   */
  extractTax(totalCents: number, taxRate: number): { subtotal: number; tax: number } {
    const subtotal = Math.round(totalCents / (1 + taxRate));
    const tax = totalCents - subtotal;
    return { subtotal, tax };
  },

  /**
   * Allocate amount across ratios (handles rounding correctly)
   * @example Money.allocate(10000, [70, 30]) // [7000, 3000]
   * @example Money.allocate(100, [33, 33, 34]) // [33, 33, 34]
   */
  allocate(totalCents: number, ratios: number[]): number[] {
    const total = ratios.reduce((a, b) => a + b, 0);
    const shares = ratios.map((r) => Math.floor((totalCents * r) / total));

    // Distribute remainder cent by cent
    let remainder = totalCents - shares.reduce((a, b) => a + b, 0);
    for (let i = 0; remainder > 0; i = (i + 1) % shares.length) {
      shares[i]++;
      remainder--;
    }

    return shares;
  },

  /**
   * Split evenly with remainder handling
   * @example Money.split(100, 3) // [34, 33, 33]
   */
  split(totalCents: number, parts: number): number[] {
    const ratios = Array(parts).fill(1);
    return this.allocate(totalCents, ratios);
  },

  /**
   * Apply discount (percentage or fixed)
   */
  applyDiscount(
    cents: number,
    discount: { type: 'percentage' | 'fixed'; value: number }
  ): number {
    if (discount.type === 'percentage') {
      return cents - this.percentage(cents, discount.value);
    }
    return Math.max(0, cents - discount.value);
  },

  /**
   * Compare two amounts
   */
  compare(a: number, b: number): -1 | 0 | 1 {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },

  /**
   * Check if amount is zero
   */
  isZero(cents: number): boolean {
    return cents === 0;
  },

  /**
   * Check if amount is positive
   */
  isPositive(cents: number): boolean {
    return cents > 0;
  },

  /**
   * Check if amount is negative
   */
  isNegative(cents: number): boolean {
    return cents < 0;
  },

  /**
   * Get absolute value
   */
  abs(cents: number): number {
    return Math.abs(cents);
  },

  /**
   * Parse string to cents (handles various formats)
   * @example Money.parse("$19.99") // 1999
   * @example Money.parse("19.99") // 1999
   * @example Money.parse("1,999.99") // 199999
   */
  parse(value: string): number {
    // Remove currency symbols and whitespace
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const dollars = parseFloat(cleaned);
    
    if (isNaN(dollars)) {
      throw new Error(`Invalid money value: ${value}`);
    }
    
    return this.toCents(dollars);
  },
};

// Type-safe currency type
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

// Money schema for database
export const moneySchema = {
  priceInCents: 'integer',
  currency: 'text',
} as const;
```

---

## 📊 PRICING COMPONENTS

```typescript
// components/pricing/pricing-card.tsx
'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLANS, type PlanKey } from '@/lib/stripe/server';
import { Money } from '@/lib/money';

interface PricingCardProps {
  planKey: PlanKey;
  isCurrentPlan?: boolean;
  isYearly?: boolean;
  onSelect?: (planKey: PlanKey) => Promise<void>;
  disabled?: boolean;
}

export function PricingCard({
  planKey,
  isCurrentPlan = false,
  isYearly = false,
  onSelect,
  disabled = false,
}: PricingCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const plan = PLANS[planKey];

  const price = isYearly ? plan.priceYearly : plan.priceMonthly;
  const monthlyEquivalent = isYearly ? plan.priceYearly / 12 : plan.priceMonthly;
  const savings = isYearly
    ? ((plan.priceMonthly * 12 - plan.priceYearly) / (plan.priceMonthly * 12)) * 100
    : 0;

  const handleSelect = async () => {
    if (!onSelect || isCurrentPlan || disabled) return;
    
    setIsLoading(true);
    try {
      await onSelect(planKey);
    } finally {
      setIsLoading(false);
    }
  };

  const isPopular = planKey === 'team';
  const isFree = planKey === 'free';

  return (
    <Card className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg' : ''}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          Most Popular
        </Badge>
      )}
      
      <CardHeader>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="mb-6">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold">
              {isFree ? 'Free' : Money.format(monthlyEquivalent * 100)}
            </span>
            {!isFree && (
              <span className="ml-1 text-muted-foreground">/month</span>
            )}
          </div>
          
          {isYearly && !isFree && (
            <div className="mt-1 text-sm text-muted-foreground">
              {Money.format(price * 100)} billed yearly
              {savings > 0 && (
                <Badge variant="secondary" className="ml-2">
                  Save {Math.round(savings)}%
                </Badge>
              )}
            </div>
          )}
        </div>

        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={isPopular ? 'default' : 'outline'}
          onClick={handleSelect}
          disabled={disabled || isLoading || isCurrentPlan}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : isFree ? (
            'Get Started'
          ) : (
            'Subscribe'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

```typescript
// components/pricing/pricing-toggle.tsx
'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (isYearly: boolean) => void;
  savingsPercent?: number;
}

export function PricingToggle({
  isYearly,
  onToggle,
  savingsPercent = 20,
}: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Label
        htmlFor="billing-toggle"
        className={!isYearly ? 'font-medium' : 'text-muted-foreground'}
      >
        Monthly
      </Label>
      
      <Switch
        id="billing-toggle"
        checked={isYearly}
        onCheckedChange={onToggle}
      />
      
      <Label
        htmlFor="billing-toggle"
        className={`flex items-center gap-2 ${isYearly ? 'font-medium' : 'text-muted-foreground'}`}
      >
        Yearly
        {savingsPercent > 0 && (
          <Badge variant="secondary">Save {savingsPercent}%</Badge>
        )}
      </Label>
    </div>
  );
}
```

---

## 💳 CHECKOUT API ROUTES

```typescript
// app/api/billing/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { StripeService } from '@/services/stripe-service';
import { STRIPE_PRICES } from '@/lib/stripe/server';
import { db } from '@/db';
import { teams, teamMembers, profiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const checkoutSchema = z.object({
  priceId: z.string(),
  teamId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { priceId, teamId, successUrl, cancelUrl } = checkoutSchema.parse(body);

    // Verify user is team owner
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.ownerId, session.user.id)))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: 'Team not found or unauthorized' }, { status: 403 });
    }

    // Verify price ID is valid
    const validPriceIds = Object.values(STRIPE_PRICES);
    if (!validPriceIds.includes(priceId as any)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    // Get user profile for email
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const checkoutSession = await StripeService.createCheckoutSession({
      teamId,
      priceId,
      userId: session.user.id,
      email: profile?.email || session.user.email!,
      successUrl: successUrl || `${baseUrl}/dashboard/billing?success=true`,
      cancelUrl: cancelUrl || `${baseUrl}/pricing`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/billing/portal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { StripeService } from '@/services/stripe-service';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const portalSchema = z.object({
  teamId: z.string().uuid(),
  returnUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { teamId, returnUrl } = portalSchema.parse(body);

    // Get team with Stripe customer ID
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.ownerId, session.user.id)))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: 'Team not found or unauthorized' }, { status: 403 });
    }

    if (!team.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const portalSession = await StripeService.createPortalSession({
      customerId: team.stripeCustomerId,
      returnUrl: returnUrl || `${baseUrl}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
```

---

## 🧪 STRIPE TESTING

```typescript
// __tests__/stripe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Money } from '@/lib/money';

describe('Money utilities', () => {
  describe('toCents', () => {
    it('converts dollars to cents', () => {
      expect(Money.toCents(19.99)).toBe(1999);
      expect(Money.toCents(0)).toBe(0);
      expect(Money.toCents(100)).toBe(10000);
    });

    it('handles floating point correctly', () => {
      // This is why we use integers!
      expect(Money.toCents(0.1 + 0.2)).toBe(30); // Not 30.000000000000004
    });
  });

  describe('format', () => {
    it('formats USD correctly', () => {
      expect(Money.format(1999)).toBe('$19.99');
      expect(Money.format(0)).toBe('$0.00');
      expect(Money.format(100000)).toBe('$1,000.00');
    });

    it('formats other currencies', () => {
      expect(Money.format(1999, 'EUR', 'de-DE')).toContain('19,99');
      expect(Money.format(1999, 'GBP', 'en-GB')).toContain('19.99');
    });
  });

  describe('allocate', () => {
    it('splits amounts correctly', () => {
      expect(Money.allocate(10000, [70, 30])).toEqual([7000, 3000]);
    });

    it('handles remainders', () => {
      expect(Money.allocate(100, [33, 33, 34])).toEqual([33, 33, 34]);
      const result = Money.allocate(100, [1, 1, 1]);
      expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    });
  });

  describe('calculateTax', () => {
    it('calculates tax correctly', () => {
      expect(Money.calculateTax(10000, 0.0825)).toBe(825);
      expect(Money.calculateTax(10000, 0.1)).toBe(1000);
    });
  });

  describe('applyDiscount', () => {
    it('applies percentage discount', () => {
      expect(Money.applyDiscount(10000, { type: 'percentage', value: 20 })).toBe(8000);
    });

    it('applies fixed discount', () => {
      expect(Money.applyDiscount(10000, { type: 'fixed', value: 2500 })).toBe(7500);
    });

    it('does not go negative', () => {
      expect(Money.applyDiscount(1000, { type: 'fixed', value: 2000 })).toBe(0);
    });
  });
});
```

---

## 🔐 SUBSCRIPTION MIDDLEWARE

```typescript
// middleware/subscription.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/db';
import { teams, teamMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function requireSubscription(
  req: NextRequest,
  options: {
    requiredPlan?: ('pro' | 'team' | 'agency')[];
    teamIdParam?: string;
  } = {}
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get team ID from request
  const teamId = options.teamIdParam
    ? req.nextUrl.searchParams.get(options.teamIdParam) || (await req.json()).teamId
    : undefined;

  if (!teamId) {
    return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
  }

  // Check user is member of team
  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id)))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
  }

  // Get team subscription
  const [team] = await db
    .select({
      subscriptionPlan: teams.subscriptionPlan,
      subscriptionStatus: teams.subscriptionStatus,
      subscriptionCurrentPeriodEnd: teams.subscriptionCurrentPeriodEnd,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Check subscription is active
  const isActive =
    team.subscriptionStatus === 'active' ||
    team.subscriptionStatus === 'trialing' ||
    (team.subscriptionCurrentPeriodEnd &&
      new Date(team.subscriptionCurrentPeriodEnd) > new Date());

  if (!isActive) {
    return NextResponse.json(
      { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
      { status: 402 }
    );
  }

  // Check plan level if required
  if (options.requiredPlan && options.requiredPlan.length > 0) {
    if (!team.subscriptionPlan || !options.requiredPlan.includes(team.subscriptionPlan as any)) {
      return NextResponse.json(
        {
          error: 'Plan upgrade required',
          code: 'PLAN_UPGRADE_REQUIRED',
          currentPlan: team.subscriptionPlan,
          requiredPlans: options.requiredPlan,
        },
        { status: 402 }
      );
    }
  }

  return null; // Continue to handler
}
```

---

## 📧 BILLING EMAILS

```typescript
// services/billing-emails.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSubscriptionCreatedEmail(email: string, planName: string) {
  await resend.emails.send({
    from: 'billing@yourdomain.com',
    to: email,
    subject: `Welcome to ${planName}!`,
    html: `
      <h1>Welcome to ${planName}!</h1>
      <p>Thank you for subscribing. Your subscription is now active.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">Go to Dashboard</a></p>
    `,
  });
}

export async function sendPaymentFailedEmail(email: string) {
  await resend.emails.send({
    from: 'billing@yourdomain.com',
    to: email,
    subject: 'Payment failed - Action required',
    html: `
      <h1>Payment Failed</h1>
      <p>We were unable to process your payment. Please update your payment method.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing">Update Payment Method</a></p>
    `,
  });
}

export async function sendTrialEndingEmail(email: string, daysRemaining: number) {
  await resend.emails.send({
    from: 'billing@yourdomain.com',
    to: email,
    subject: `Your trial ends in ${daysRemaining} days`,
    html: `
      <h1>Trial Ending Soon</h1>
      <p>Your trial will end in ${daysRemaining} days. Subscribe now to continue using all features.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing">View Plans</a></p>
    `,
  });
}

export async function sendSubscriptionCanceledEmail(email: string, endDate: Date) {
  await resend.emails.send({
    from: 'billing@yourdomain.com',
    to: email,
    subject: 'Subscription canceled',
    html: `
      <h1>Subscription Canceled</h1>
      <p>Your subscription has been canceled. You'll continue to have access until ${endDate.toLocaleDateString()}.</p>
      <p>We'd love to have you back! <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing">Resubscribe</a></p>
    `,
  });
}
```

---

## ⚙️ ENVIRONMENT VARIABLES

```bash
# .env.example - Stripe configuration

# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from dashboard)
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_...
STRIPE_TEAM_YEARLY_PRICE_ID=price_...
STRIPE_AGENCY_MONTHLY_PRICE_ID=price_...
STRIPE_AGENCY_YEARLY_PRICE_ID=price_...

# Stripe Portal Configuration ID (optional)
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
```

---

## 🎯 STRIPE CHECKLIST

```markdown
## Setup Checklist

### Stripe Dashboard
- [ ] Create Stripe account
- [ ] Set up products and prices
- [ ] Configure customer portal
- [ ] Set up webhook endpoint
- [ ] Configure tax settings (if needed)

### Environment
- [ ] Add STRIPE_SECRET_KEY
- [ ] Add STRIPE_PUBLISHABLE_KEY
- [ ] Add STRIPE_WEBHOOK_SECRET
- [ ] Add all price IDs

### Code
- [ ] Implement checkout flow
- [ ] Implement webhook handler
- [ ] Add subscription middleware
- [ ] Create pricing page
- [ ] Create billing page
- [ ] Test all flows

### Testing
- [ ] Test checkout (card: 4242424242424242)
- [ ] Test failed payment (card: 4000000000000002)
- [ ] Test subscription update
- [ ] Test subscription cancel
- [ ] Test webhook handling
- [ ] Test portal access
```

---
