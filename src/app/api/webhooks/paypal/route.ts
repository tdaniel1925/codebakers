import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhook } from '@/lib/paypal';
import { TeamService } from '@/services/team-service';
import { PricingService } from '@/services/pricing-service';
import { subscriptionPlanSchema } from '@/lib/validations';
import { logger, getRequestId } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface PayPalResource {
  id: string;
  status?: string;
  custom_id?: string; // This is our teamId
  plan_id?: string;
  subscriber?: {
    email_address?: string;
  };
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: PayPalResource;
  summary: string;
  create_time: string;
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);

  try {
    const body = await req.text();
    const event: PayPalWebhookEvent = JSON.parse(body);

    // Verify webhook signature
    const authAlgo = req.headers.get('paypal-auth-algo');
    const certUrl = req.headers.get('paypal-cert-url');
    const transmissionId = req.headers.get('paypal-transmission-id');
    const transmissionSig = req.headers.get('paypal-transmission-sig');
    const transmissionTime = req.headers.get('paypal-transmission-time');

    if (authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime) {
      const isValid = await verifyPayPalWebhook({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookId: process.env.PAYPAL_WEBHOOK_ID!,
        webhookEvent: event,
      });

      if (!isValid) {
        logger.error('PayPal Webhook: Signature verification failed', { requestId, eventId: event.id });
        return NextResponse.json(
          { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        );
      }
    }

    // Handle different event types
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event.resource, requestId);
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event.resource, requestId);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handleSubscriptionCanceled(event.resource, requestId);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event.resource, requestId);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        // Payment successful - subscription should already be active
        logger.info('PayPal Webhook: Payment completed', { requestId, eventId: event.id });
        break;

      case 'PAYMENT.SALE.DENIED':
      case 'PAYMENT.SALE.REFUNDED':
        await handlePaymentIssue(event.resource, requestId);
        break;

      default:
        logger.info(`PayPal Webhook: Unhandled event ${event.event_type}`, { requestId, eventType: event.event_type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('PayPal Webhook: Processing error', { requestId }, error instanceof Error ? error : undefined);
    // Return 500 to allow PayPal to retry - silent failures mask subscription state issues
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Event handlers
async function handleSubscriptionActivated(resource: PayPalResource, requestId: string) {
  const teamId = resource.custom_id;
  if (!teamId) {
    logger.error('PayPal Webhook: No teamId in subscription resource', { requestId, subscriptionId: resource.id });
    return;
  }

  // Get plan details from the plan_id if available
  const plans = await PricingService.getAllPlans();
  const matchingPlan = plans.find(p => p.paypalPlanId === resource.plan_id);

  // Validate plan using Zod schema
  const planResult = subscriptionPlanSchema.safeParse(matchingPlan?.plan);
  if (!planResult.success) {
    logger.error('PayPal Webhook: Invalid or missing plan', { requestId, planId: resource.plan_id });
    throw new Error(`Invalid plan mapping for PayPal plan_id: ${resource.plan_id}`);
  }

  await TeamService.updatePayPalInfo(teamId, {
    paypalSubscriptionId: resource.id,
    subscriptionStatus: 'active',
    subscriptionPlan: planResult.data,
    seatLimit: matchingPlan?.seats || 1,
  });

  logger.billingEvent('Subscription activated', teamId, requestId, { subscriptionId: resource.id });
}

async function handleSubscriptionUpdated(resource: PayPalResource, requestId: string) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    logger.error('PayPal Webhook: No team found for subscription', { requestId, subscriptionId: resource.id });
    return;
  }

  const status = resource.status?.toLowerCase() || 'active';
  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: status === 'active' ? 'active' : status,
  });

  logger.billingEvent('Subscription updated', team.id, requestId, { status });
}

async function handleSubscriptionCanceled(resource: PayPalResource, requestId: string) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    logger.error('PayPal Webhook: No team found for subscription', { requestId, subscriptionId: resource.id });
    return;
  }

  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: 'canceled',
  });

  logger.billingEvent('Subscription canceled', team.id, requestId);
}

async function handleSubscriptionSuspended(resource: PayPalResource, requestId: string) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    logger.error('PayPal Webhook: No team found for subscription', { requestId, subscriptionId: resource.id });
    return;
  }

  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: 'past_due',
  });

  logger.billingEvent('Subscription suspended', team.id, requestId);
}

async function handlePaymentIssue(resource: PayPalResource, requestId: string) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    logger.error('PayPal Webhook: No team found for subscription', { requestId, subscriptionId: resource.id });
    return;
  }

  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: 'past_due',
  });

  logger.billingEvent('Payment issue', team.id, requestId);
}
