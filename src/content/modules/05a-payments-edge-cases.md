# PAYMENTS EDGE CASES
# Module: 05a-payments-edge-cases.md
# Load with: 00-core.md, 05-payments.md
# Covers: Failed payments, refunds, disputes, dunning, proration, race conditions

---

## 🚨 FAILED PAYMENT HANDLING

### Dunning Management (Payment Retry Logic)

```typescript
// services/dunning-service.ts
import { db } from '@/db';
import { teams, subscriptions, paymentAttempts } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { stripe } from '@/lib/stripe/server';
import { EmailService } from '@/services/email-service';

export const DUNNING_SCHEDULE = {
  // Days after initial failure to retry
  retryDays: [1, 3, 5, 7],
  // Days of grace period before cancellation
  gracePeriodDays: 14,
  // Max retries before giving up
  maxRetries: 4,
};

export class DunningService {
  /**
   * Handle failed payment - called from webhook
   */
  static async handleFailedPayment(
    customerId: string,
    invoiceId: string,
    failureCode: string,
    failureMessage: string
  ): Promise<void> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.stripeCustomerId, customerId))
      .limit(1);

    if (!team) return;

    // Log the attempt
    const [attempt] = await db
      .insert(paymentAttempts)
      .values({
        teamId: team.id,
        invoiceId,
        status: 'failed',
        failureCode,
        failureMessage,
        attemptNumber: await this.getAttemptCount(team.id, invoiceId) + 1,
      })
      .returning();

    // Determine action based on failure type
    const action = this.determineAction(failureCode, attempt.attemptNumber);

    switch (action) {
      case 'retry_later':
        await this.scheduleRetry(team.id, invoiceId, attempt.attemptNumber);
        break;
      case 'request_update':
        await this.requestPaymentMethodUpdate(team, failureCode);
        break;
      case 'cancel_subscription':
        await this.initiateGracePeriod(team.id);
        break;
    }
  }

  /**
   * Determine action based on failure code
   */
  private static determineAction(
    failureCode: string,
    attemptNumber: number
  ): 'retry_later' | 'request_update' | 'cancel_subscription' {
    // Hard declines - card is definitively rejected
    const hardDeclines = [
      'card_declined',
      'expired_card',
      'incorrect_cvc',
      'incorrect_number',
      'stolen_card',
      'lost_card',
      'fraudulent',
    ];

    // Soft declines - temporary issues, worth retrying
    const softDeclines = [
      'insufficient_funds',
      'processing_error',
      'try_again_later',
      'generic_decline',
    ];

    if (hardDeclines.includes(failureCode)) {
      return 'request_update';
    }

    if (softDeclines.includes(failureCode) && attemptNumber < DUNNING_SCHEDULE.maxRetries) {
      return 'retry_later';
    }

    if (attemptNumber >= DUNNING_SCHEDULE.maxRetries) {
      return 'cancel_subscription';
    }

    return 'request_update';
  }

  /**
   * Schedule a retry attempt
   */
  private static async scheduleRetry(
    teamId: string,
    invoiceId: string,
    attemptNumber: number
  ): Promise<void> {
    const nextRetryDays = DUNNING_SCHEDULE.retryDays[attemptNumber - 1] || 7;
    const nextRetryAt = new Date(Date.now() + nextRetryDays * 24 * 60 * 60 * 1000);

    // Store scheduled retry (use your job queue)
    await db.insert(scheduledRetries).values({
      teamId,
      invoiceId,
      scheduledFor: nextRetryAt,
      attemptNumber: attemptNumber + 1,
    });

    console.log(`Scheduled retry ${attemptNumber + 1} for invoice ${invoiceId} at ${nextRetryAt}`);
  }

  /**
   * Request customer to update payment method
   */
  private static async requestPaymentMethodUpdate(
    team: typeof teams.$inferSelect,
    failureCode: string
  ): Promise<void> {
    // Create portal session for easy update
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: team.stripeCustomerId!,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      flow_data: {
        type: 'payment_method_update',
      },
    });

    // Send appropriate email based on failure
    await EmailService.send({
      to: team.billingEmail || team.ownerEmail,
      templateId: this.getEmailTemplate(failureCode),
      data: {
        teamName: team.name,
        updateUrl: portalSession.url,
        failureReason: this.getHumanReadableError(failureCode),
      },
    });

    // Update team status
    await db.update(teams).set({
      subscriptionStatus: 'past_due',
      paymentFailedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(teams.id, team.id));
  }

  /**
   * Start grace period before cancellation
   */
  private static async initiateGracePeriod(teamId: string): Promise<void> {
    const gracePeriodEnd = new Date(
      Date.now() + DUNNING_SCHEDULE.gracePeriodDays * 24 * 60 * 60 * 1000
    );

    await db.update(teams).set({
      subscriptionStatus: 'past_due',
      gracePeriodEndsAt: gracePeriodEnd,
      updatedAt: new Date(),
    }).where(eq(teams.id, teamId));

    // Send final warning email
    await EmailService.send({
      to: team.billingEmail,
      templateId: 'grace-period-started',
      data: {
        gracePeriodEnd,
        daysRemaining: DUNNING_SCHEDULE.gracePeriodDays,
      },
    });
  }

  /**
   * Process grace period expirations (run daily via cron)
   */
  static async processGracePeriodExpirations(): Promise<void> {
    const expiredTeams = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.subscriptionStatus, 'past_due'),
          lt(teams.gracePeriodEndsAt, new Date())
        )
      );

    for (const team of expiredTeams) {
      if (team.stripeSubscriptionId) {
        // Cancel subscription in Stripe
        await stripe.subscriptions.cancel(team.stripeSubscriptionId, {
          prorate: false,
        });
      }

      // Update team
      await db.update(teams).set({
        subscriptionPlan: 'free',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      }).where(eq(teams.id, team.id));

      // Send cancellation email
      await EmailService.send({
        to: team.billingEmail,
        templateId: 'subscription-canceled-nonpayment',
        data: { teamName: team.name },
      });
    }
  }

  private static getAttemptCount(teamId: string, invoiceId: string): Promise<number> {
    // Implementation
  }

  private static getEmailTemplate(failureCode: string): string {
    const templates: Record<string, string> = {
      expired_card: 'payment-failed-expired-card',
      insufficient_funds: 'payment-failed-insufficient-funds',
      card_declined: 'payment-failed-declined',
      default: 'payment-failed-generic',
    };
    return templates[failureCode] || templates.default;
  }

  private static getHumanReadableError(code: string): string {
    const messages: Record<string, string> = {
      expired_card: 'Your card has expired',
      insufficient_funds: 'Your card has insufficient funds',
      card_declined: 'Your card was declined',
      incorrect_cvc: 'The security code was incorrect',
      processing_error: 'There was a processing error',
    };
    return messages[code] || 'Your payment could not be processed';
  }
}
```

---

## 💰 REFUND HANDLING

```typescript
// services/refund-service.ts
import { stripe } from '@/lib/stripe/server';
import { db } from '@/db';
import { refunds, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Money } from '@/lib/money';

export type RefundReason =
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'product_unsatisfactory';

export class RefundService {
  /**
   * Issue a full refund
   */
  static async issueFullRefund(
    chargeId: string,
    reason: RefundReason,
    metadata?: Record<string, string>
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const refund = await stripe.refunds.create({
        charge: chargeId,
        reason: reason === 'product_unsatisfactory' ? 'requested_by_customer' : reason,
        metadata: {
          ...metadata,
          internal_reason: reason,
        },
      });

      // Log refund
      await db.insert(refunds).values({
        stripeRefundId: refund.id,
        stripeChargeId: chargeId,
        amountCents: refund.amount,
        reason,
        status: refund.status || 'succeeded',
        metadata,
      });

      return { success: true, refundId: refund.id };
    } catch (error) {
      console.error('Refund failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Issue partial refund
   */
  static async issuePartialRefund(
    chargeId: string,
    amountCents: number,
    reason: RefundReason
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      // Verify amount is valid
      const charge = await stripe.charges.retrieve(chargeId);
      const alreadyRefunded = charge.amount_refunded;
      const maxRefundable = charge.amount - alreadyRefunded;

      if (amountCents > maxRefundable) {
        return {
          success: false,
          error: `Maximum refundable amount is ${Money.format(maxRefundable)}`,
        };
      }

      const refund = await stripe.refunds.create({
        charge: chargeId,
        amount: amountCents,
        reason: 'requested_by_customer',
        metadata: { internal_reason: reason },
      });

      await db.insert(refunds).values({
        stripeRefundId: refund.id,
        stripeChargeId: chargeId,
        amountCents,
        reason,
        status: refund.status || 'succeeded',
      });

      return { success: true, refundId: refund.id };
    } catch (error) {
      console.error('Partial refund failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Cancel and refund subscription immediately
   */
  static async cancelAndRefund(
    teamId: string,
    reason: RefundReason
  ): Promise<{ success: boolean; refundedAmount?: number; error?: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription' };
    }

    try {
      // Get the subscription
      const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);

      // Calculate prorated refund amount
      const now = Math.floor(Date.now() / 1000);
      const periodStart = subscription.current_period_start;
      const periodEnd = subscription.current_period_end;
      const totalPeriod = periodEnd - periodStart;
      const elapsed = now - periodStart;
      const remaining = totalPeriod - elapsed;

      const lastInvoice = await stripe.invoices.retrieve(
        subscription.latest_invoice as string
      );
      const proratedRefund = Math.round(
        (remaining / totalPeriod) * lastInvoice.amount_paid
      );

      // Cancel subscription immediately
      await stripe.subscriptions.cancel(team.stripeSubscriptionId, {
        prorate: false, // We're handling refund manually
      });

      // Issue prorated refund
      if (proratedRefund > 0 && lastInvoice.charge) {
        await this.issuePartialRefund(
          lastInvoice.charge as string,
          proratedRefund,
          reason
        );
      }

      // Update team
      await db.update(teams).set({
        subscriptionPlan: 'free',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      }).where(eq(teams.id, teamId));

      return { success: true, refundedAmount: proratedRefund };
    } catch (error) {
      console.error('Cancel and refund failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  }
}
```

---

## ⚔️ DISPUTE/CHARGEBACK HANDLING

```typescript
// services/dispute-service.ts
import { stripe } from '@/lib/stripe/server';
import { db } from '@/db';
import { disputes, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

export class DisputeService {
  /**
   * Handle dispute created webhook
   */
  static async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const chargeId = dispute.charge as string;
    const charge = await stripe.charges.retrieve(chargeId);

    // Find the team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.stripeCustomerId, charge.customer as string))
      .limit(1);

    // Log the dispute
    await db.insert(disputes).values({
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      teamId: team?.id,
      amountCents: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
      evidenceDueBy: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000)
        : null,
    });

    // Alert the team
    await this.alertTeam(dispute, team);

    // Restrict account if needed
    if (team) {
      await db.update(teams).set({
        hasActiveDispute: true,
        updatedAt: new Date(),
      }).where(eq(teams.id, team.id));
    }
  }

  /**
   * Submit dispute evidence
   */
  static async submitEvidence(
    disputeId: string,
    evidence: {
      customerName?: string;
      customerEmail?: string;
      productDescription?: string;
      serviceDate?: string;
      billingAddress?: string;
      customerSignature?: string; // File ID
      receipt?: string; // File ID
      serviceDocumentation?: string;
      uncategorizedText?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await stripe.disputes.update(disputeId, {
        evidence: {
          customer_name: evidence.customerName,
          customer_email_address: evidence.customerEmail,
          product_description: evidence.productDescription,
          service_date: evidence.serviceDate,
          billing_address: evidence.billingAddress,
          customer_signature: evidence.customerSignature,
          receipt: evidence.receipt,
          service_documentation: evidence.serviceDocumentation,
          uncategorized_text: evidence.uncategorizedText,
        },
        submit: true,
      });

      await db.update(disputes).set({
        evidenceSubmitted: true,
        evidenceSubmittedAt: new Date(),
      }).where(eq(disputes.stripeDisputeId, disputeId));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit evidence',
      };
    }
  }

  /**
   * Handle dispute closed (won or lost)
   */
  static async handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
    const won = dispute.status === 'won';

    await db.update(disputes).set({
      status: dispute.status,
      closedAt: new Date(),
      won,
    }).where(eq(disputes.stripeDisputeId, dispute.id));

    // Find team and update status
    const [disputeRecord] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.stripeDisputeId, dispute.id))
      .limit(1);

    if (disputeRecord?.teamId) {
      // Check if team has any other active disputes
      const activeDisputes = await db
        .select()
        .from(disputes)
        .where(
          and(
            eq(disputes.teamId, disputeRecord.teamId),
            eq(disputes.status, 'needs_response')
          )
        );

      if (activeDisputes.length === 0) {
        await db.update(teams).set({
          hasActiveDispute: false,
          updatedAt: new Date(),
        }).where(eq(teams.id, disputeRecord.teamId));
      }

      // If lost, may need to take action
      if (!won) {
        await this.handleLostDispute(disputeRecord.teamId, dispute);
      }
    }
  }

  /**
   * Handle lost dispute - may need to restrict account
   */
  private static async handleLostDispute(
    teamId: string,
    dispute: Stripe.Dispute
  ): Promise<void> {
    // Log for review
    console.warn(`Lost dispute for team ${teamId}: ${dispute.id}`);

    // Check dispute history
    const disputeHistory = await db
      .select()
      .from(disputes)
      .where(
        and(
          eq(disputes.teamId, teamId),
          eq(disputes.won, false)
        )
      );

    // If multiple lost disputes, flag for review
    if (disputeHistory.length >= 2) {
      await db.update(teams).set({
        flaggedForReview: true,
        flagReason: 'multiple_lost_disputes',
        updatedAt: new Date(),
      }).where(eq(teams.id, teamId));
    }
  }

  private static async alertTeam(
    dispute: Stripe.Dispute,
    team: typeof teams.$inferSelect | undefined
  ): Promise<void> {
    // Send email alert about dispute
    // Implementation
  }
}
```

---

## 🔄 SUBSCRIPTION LIFECYCLE EDGE CASES

```typescript
// services/subscription-lifecycle.ts
import { stripe } from '@/lib/stripe/server';
import { db } from '@/db';
import { teams, subscriptionHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Money } from '@/lib/money';

export class SubscriptionLifecycle {
  /**
   * Handle upgrade with proration preview
   */
  static async previewUpgrade(
    teamId: string,
    newPriceId: string
  ): Promise<{
    currentPlan: string;
    newPlan: string;
    proratedAmount: number;
    immediateCharge: number;
    nextBillingDate: Date;
    nextBillingAmount: number;
  }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripeSubscriptionId || !team.stripeCustomerId) {
      throw new Error('No active subscription');
    }

    const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);

    // Get upcoming invoice preview with the new price
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: team.stripeCustomerId,
      subscription: team.stripeSubscriptionId,
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      subscription_proration_behavior: 'create_prorations',
    });

    // Calculate proration
    const prorationItems = upcomingInvoice.lines.data.filter(
      line => line.proration
    );
    const proratedAmount = prorationItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // Get the new recurring amount
    const recurringItems = upcomingInvoice.lines.data.filter(
      line => !line.proration
    );
    const nextBillingAmount = recurringItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    return {
      currentPlan: team.subscriptionPlan || 'free',
      newPlan: this.getPlanFromPriceId(newPriceId),
      proratedAmount: Math.max(0, proratedAmount), // Could be negative for downgrades
      immediateCharge: proratedAmount > 0 ? proratedAmount : 0,
      nextBillingDate: new Date(upcomingInvoice.next_payment_attempt! * 1000),
      nextBillingAmount,
    };
  }

  /**
   * Execute upgrade with proper proration handling
   */
  static async executeUpgrade(
    teamId: string,
    newPriceId: string,
    options?: {
      prorationBehavior?: 'create_prorations' | 'always_invoice' | 'none';
      paymentBehavior?: 'allow_incomplete' | 'error_if_incomplete';
    }
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription' };
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);

      const updated = await stripe.subscriptions.update(team.stripeSubscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: options?.prorationBehavior || 'create_prorations',
        payment_behavior: options?.paymentBehavior || 'error_if_incomplete',
      });

      // Log the change
      await db.insert(subscriptionHistory).values({
        teamId,
        action: 'upgrade',
        fromPlan: team.subscriptionPlan,
        toPlan: this.getPlanFromPriceId(newPriceId),
        stripeSubscriptionId: updated.id,
      });

      // Update team
      await db.update(teams).set({
        subscriptionPlan: this.getPlanFromPriceId(newPriceId) as any,
        updatedAt: new Date(),
      }).where(eq(teams.id, teamId));

      return { success: true, subscriptionId: updated.id };
    } catch (error) {
      console.error('Upgrade failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upgrade failed',
      };
    }
  }

  /**
   * Pause subscription (keep subscription but stop billing)
   */
  static async pauseSubscription(
    teamId: string,
    options?: {
      resumesAt?: Date;
      behavior?: 'mark_uncollectible' | 'keep_as_draft' | 'void';
    }
  ): Promise<{ success: boolean; error?: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription' };
    }

    try {
      // Pause collection
      await stripe.subscriptions.update(team.stripeSubscriptionId, {
        pause_collection: {
          behavior: options?.behavior || 'mark_uncollectible',
          resumes_at: options?.resumesAt
            ? Math.floor(options.resumesAt.getTime() / 1000)
            : undefined,
        },
      });

      await db.update(teams).set({
        subscriptionStatus: 'paused',
        subscriptionPausedAt: new Date(),
        subscriptionResumesAt: options?.resumesAt,
        updatedAt: new Date(),
      }).where(eq(teams.id, teamId));

      await db.insert(subscriptionHistory).values({
        teamId,
        action: 'pause',
        metadata: { resumesAt: options?.resumesAt?.toISOString() },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pause failed',
      };
    }
  }

  /**
   * Resume paused subscription
   */
  static async resumeSubscription(teamId: string): Promise<{ success: boolean; error?: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripeSubscriptionId) {
      return { success: false, error: 'No subscription to resume' };
    }

    try {
      await stripe.subscriptions.update(team.stripeSubscriptionId, {
        pause_collection: null, // This resumes the subscription
      });

      await db.update(teams).set({
        subscriptionStatus: 'active',
        subscriptionPausedAt: null,
        subscriptionResumesAt: null,
        updatedAt: new Date(),
      }).where(eq(teams.id, teamId));

      await db.insert(subscriptionHistory).values({
        teamId,
        action: 'resume',
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Resume failed',
      };
    }
  }

  /**
   * Handle subscription with past due invoices when upgrading
   */
  static async upgradeWithOutstandingBalance(
    teamId: string,
    newPriceId: string
  ): Promise<{ success: boolean; error?: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team?.stripeCustomerId) {
      return { success: false, error: 'No customer found' };
    }

    // Check for outstanding invoices
    const invoices = await stripe.invoices.list({
      customer: team.stripeCustomerId,
      status: 'open',
    });

    if (invoices.data.length > 0) {
      // Attempt to pay outstanding invoices first
      for (const invoice of invoices.data) {
        try {
          await stripe.invoices.pay(invoice.id);
        } catch (error) {
          return {
            success: false,
            error: `Please pay outstanding invoice of ${Money.format(invoice.amount_due)} first`,
          };
        }
      }
    }

    // Now proceed with upgrade
    return this.executeUpgrade(teamId, newPriceId);
  }

  private static getPlanFromPriceId(priceId: string): string {
    // Implementation - map price ID to plan name
    const priceMap: Record<string, string> = {
      [process.env.STRIPE_PRO_MONTHLY_PRICE_ID!]: 'pro',
      [process.env.STRIPE_PRO_YEARLY_PRICE_ID!]: 'pro',
      [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!]: 'team',
      [process.env.STRIPE_TEAM_YEARLY_PRICE_ID!]: 'team',
    };
    return priceMap[priceId] || 'free';
  }
}
```

---

## 🔐 IDEMPOTENCY & RACE CONDITIONS

```typescript
// lib/stripe/idempotency.ts
import { stripe } from '@/lib/stripe/server';
import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generate idempotency key for Stripe operations
 * Prevents duplicate charges on retry
 */
export function generateIdempotencyKey(
  operation: string,
  ...identifiers: string[]
): string {
  const input = [operation, ...identifiers, Date.now().toString()].join(':');
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/**
 * Execute Stripe operation with idempotency
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  options?: { expiresInMs?: number }
): Promise<T> {
  const expiresAt = new Date(Date.now() + (options?.expiresInMs || 24 * 60 * 60 * 1000));

  // Check if operation already completed
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.key, key),
        gt(idempotencyKeys.expiresAt, new Date())
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === 'completed' && existing.result) {
      return JSON.parse(existing.result) as T;
    }
    if (existing.status === 'processing') {
      throw new Error('Operation already in progress');
    }
  }

  // Mark as processing
  await db.insert(idempotencyKeys).values({
    key,
    status: 'processing',
    expiresAt,
  }).onConflictDoUpdate({
    target: idempotencyKeys.key,
    set: { status: 'processing', updatedAt: new Date() },
  });

  try {
    const result = await operation();

    // Mark as completed
    await db.update(idempotencyKeys).set({
      status: 'completed',
      result: JSON.stringify(result),
      updatedAt: new Date(),
    }).where(eq(idempotencyKeys.key, key));

    return result;
  } catch (error) {
    // Mark as failed
    await db.update(idempotencyKeys).set({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: new Date(),
    }).where(eq(idempotencyKeys.key, key));

    throw error;
  }
}

/**
 * Stripe operation with built-in idempotency key
 */
export async function createCheckoutWithIdempotency(
  teamId: string,
  priceId: string,
  params: Parameters<typeof stripe.checkout.sessions.create>[0]
) {
  const idempotencyKey = generateIdempotencyKey('checkout', teamId, priceId);

  return stripe.checkout.sessions.create(params, {
    idempotencyKey,
  });
}

/**
 * Prevent concurrent subscription modifications
 */
export async function withSubscriptionLock<T>(
  teamId: string,
  operation: () => Promise<T>
): Promise<T> {
  const lockKey = `subscription_lock:${teamId}`;

  // Try to acquire lock
  const acquired = await acquireLock(lockKey, 30000); // 30 second timeout

  if (!acquired) {
    throw new Error('Subscription modification already in progress');
  }

  try {
    return await operation();
  } finally {
    await releaseLock(lockKey);
  }
}

// Simple lock implementation (use Redis in production)
const locks = new Map<string, { expires: number }>();

async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const now = Date.now();
  const existing = locks.get(key);

  if (existing && existing.expires > now) {
    return false;
  }

  locks.set(key, { expires: now + ttlMs });
  return true;
}

async function releaseLock(key: string): Promise<void> {
  locks.delete(key);
}
```

---

## 🌍 MULTI-CURRENCY HANDLING

```typescript
// lib/stripe/currency.ts
import { stripe } from '@/lib/stripe/server';
import { Money } from '@/lib/money';

export type SupportedCurrency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud';

// Zero-decimal currencies (amount is in whole units, not cents)
const ZERO_DECIMAL_CURRENCIES = [
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
];

export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase());
}

export function toStripeAmount(amount: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) {
    return Math.round(amount);
  }
  return amount; // Already in smallest unit (cents)
}

export function fromStripeAmount(amount: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) {
    return amount;
  }
  return amount; // Already in cents
}

/**
 * Format amount for display with proper currency symbol
 */
export function formatCurrency(
  amountCents: number,
  currency: SupportedCurrency,
  locale?: string
): string {
  const localeMap: Record<SupportedCurrency, string> = {
    usd: 'en-US',
    eur: 'de-DE',
    gbp: 'en-GB',
    cad: 'en-CA',
    aud: 'en-AU',
  };

  return Money.format(amountCents, currency.toUpperCase(), locale || localeMap[currency]);
}

/**
 * Get customer's preferred currency based on location
 */
export async function detectCustomerCurrency(
  ipAddress: string
): Promise<SupportedCurrency> {
  // Use a geolocation service or IP lookup
  // This is a simplified example
  const countryToCurrency: Record<string, SupportedCurrency> = {
    US: 'usd',
    CA: 'cad',
    GB: 'gbp',
    AU: 'aud',
    DE: 'eur',
    FR: 'eur',
    // Add more mappings
  };

  // Default to USD
  return 'usd';
}

/**
 * Create prices in multiple currencies
 */
export async function createMultiCurrencyPrices(
  productId: string,
  amounts: Record<SupportedCurrency, number>
): Promise<Record<SupportedCurrency, string>> {
  const priceIds: Record<string, string> = {};

  for (const [currency, amount] of Object.entries(amounts)) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: toStripeAmount(amount, currency),
      currency,
      recurring: { interval: 'month' },
    });
    priceIds[currency] = price.id;
  }

  return priceIds as Record<SupportedCurrency, string>;
}
```

---

## 🪝 WEBHOOK EDGE CASES

```typescript
// app/api/webhooks/stripe/edge-cases.ts
import Stripe from 'stripe';
import { db } from '@/db';
import { webhookEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Handle webhook with idempotency (prevent duplicate processing)
 */
export async function processWebhookIdempotently(
  event: Stripe.Event,
  handler: () => Promise<void>
): Promise<{ processed: boolean; duplicate: boolean }> {
  // Check if we've already processed this event
  const [existing] = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.stripeEventId, event.id))
    .limit(1);

  if (existing?.processedAt) {
    console.log(`Skipping duplicate webhook: ${event.id}`);
    return { processed: false, duplicate: true };
  }

  // Mark as processing
  await db.insert(webhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    receivedAt: new Date(),
  }).onConflictDoNothing();

  try {
    await handler();

    // Mark as processed
    await db.update(webhookEvents).set({
      processedAt: new Date(),
      status: 'success',
    }).where(eq(webhookEvents.stripeEventId, event.id));

    return { processed: true, duplicate: false };
  } catch (error) {
    // Log failure but don't throw (we'll handle retries via Stripe)
    await db.update(webhookEvents).set({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      attempts: (existing?.attempts || 0) + 1,
    }).where(eq(webhookEvents.stripeEventId, event.id));

    throw error;
  }
}

/**
 * Handle out-of-order webhooks
 * Example: subscription.updated arrives before checkout.session.completed
 */
export async function handleOutOfOrderWebhook(
  event: Stripe.Event
): Promise<'process' | 'defer' | 'skip'> {
  const objectId = (event.data.object as any).id;
  const created = event.created;

  // Check for prerequisite events that haven't arrived yet
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const teamId = subscription.metadata?.teamId;

    if (!teamId) {
      // Team ID not set yet - the checkout.session.completed hasn't processed
      // Defer processing
      return 'defer';
    }
  }

  // Check if we have a more recent event of the same type
  const [moreRecent] = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.objectId, objectId),
        eq(webhookEvents.eventType, event.type),
        gt(webhookEvents.eventCreatedAt, new Date(created * 1000))
      )
    )
    .limit(1);

  if (moreRecent) {
    console.log(`Skipping outdated event ${event.id}, newer event exists`);
    return 'skip';
  }

  return 'process';
}

/**
 * Retry deferred webhooks
 */
export async function retryDeferredWebhooks(): Promise<void> {
  const deferred = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.status, 'deferred'),
        lt(webhookEvents.deferredUntil, new Date())
      )
    )
    .limit(100);

  for (const event of deferred) {
    // Re-process the event
    // You'd need to store the full event payload to do this
  }
}
```

---

## 🧪 PAYMENT EDGE CASE TESTS

```typescript
// __tests__/payments/edge-cases.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DunningService, DUNNING_SCHEDULE } from '@/services/dunning-service';
import { RefundService } from '@/services/refund-service';
import { SubscriptionLifecycle } from '@/services/subscription-lifecycle';

describe('Payment Edge Cases', () => {
  describe('Dunning', () => {
    it('retries soft declines', async () => {
      const action = DunningService['determineAction']('insufficient_funds', 1);
      expect(action).toBe('retry_later');
    });

    it('requests update for hard declines', async () => {
      const action = DunningService['determineAction']('expired_card', 1);
      expect(action).toBe('request_update');
    });

    it('cancels after max retries', async () => {
      const action = DunningService['determineAction'](
        'insufficient_funds',
        DUNNING_SCHEDULE.maxRetries
      );
      expect(action).toBe('cancel_subscription');
    });
  });

  describe('Refunds', () => {
    it('prevents refund exceeding charge amount', async () => {
      const result = await RefundService.issuePartialRefund(
        'ch_test_123',
        999999999, // Exceeds charge
        'requested_by_customer'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum refundable');
    });
  });

  describe('Subscription Lifecycle', () => {
    it('calculates proration correctly for upgrades', async () => {
      // Mock the preview
      const preview = await SubscriptionLifecycle.previewUpgrade(
        'team_123',
        'price_team_monthly'
      );

      expect(preview.proratedAmount).toBeGreaterThanOrEqual(0);
      expect(preview.nextBillingDate).toBeInstanceOf(Date);
    });

    it('handles pause and resume', async () => {
      const pauseResult = await SubscriptionLifecycle.pauseSubscription('team_123');
      expect(pauseResult.success).toBe(true);

      const resumeResult = await SubscriptionLifecycle.resumeSubscription('team_123');
      expect(resumeResult.success).toBe(true);
    });
  });
});
```

---

## 📋 PAYMENT EDGE CASES CHECKLIST

```markdown
## Edge Cases Covered

### Failed Payments
- [ ] Dunning schedule configured (retry logic)
- [ ] Hard vs soft decline handling
- [ ] Grace period before cancellation
- [ ] Customer notification on failure
- [ ] Payment method update flow

### Refunds
- [ ] Full refund capability
- [ ] Partial refund with validation
- [ ] Prorated refund on cancellation
- [ ] Refund limits enforced

### Disputes
- [ ] Dispute webhook handling
- [ ] Evidence submission flow
- [ ] Account flagging on disputes
- [ ] Lost dispute consequences

### Subscription Changes
- [ ] Upgrade proration preview
- [ ] Downgrade handling
- [ ] Pause/resume functionality
- [ ] Outstanding balance handling

### Race Conditions
- [ ] Idempotency keys on all operations
- [ ] Subscription modification locks
- [ ] Webhook deduplication

### Multi-Currency
- [ ] Zero-decimal currency handling
- [ ] Currency detection
- [ ] Proper formatting

### Webhooks
- [ ] Event deduplication
- [ ] Out-of-order handling
- [ ] Retry logic
- [ ] Failure logging
```

---
