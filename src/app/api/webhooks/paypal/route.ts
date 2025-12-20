import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhook } from '@/lib/paypal';
import { TeamService } from '@/services/team-service';
import { PricingService } from '@/services/pricing-service';

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
        console.error('[PayPal Webhook] Signature verification failed');
        return NextResponse.json(
          { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        );
      }
    }

    // Handle different event types
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handleSubscriptionCanceled(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event.resource);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        // Payment successful - subscription should already be active
        console.log('[PayPal Webhook] Payment completed:', event.id);
        break;

      case 'PAYMENT.SALE.DENIED':
      case 'PAYMENT.SALE.REFUNDED':
        await handlePaymentIssue(event.resource);
        break;

      default:
        console.log(`[PayPal Webhook] Unhandled event: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[PayPal Webhook] Processing error:', error);
    // Always return 200 to prevent retries for processing errors
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Event handlers
async function handleSubscriptionActivated(resource: PayPalResource) {
  const teamId = resource.custom_id;
  if (!teamId) {
    console.error('[PayPal Webhook] No teamId in subscription resource');
    return;
  }

  // Get plan details from the plan_id if available
  const plans = await PricingService.getAllPlans();
  const matchingPlan = plans.find(p => p.paypalPlanId === resource.plan_id);

  await TeamService.updatePayPalInfo(teamId, {
    paypalSubscriptionId: resource.id,
    subscriptionStatus: 'active',
    subscriptionPlan: matchingPlan?.plan as 'pro' | 'team' | 'agency' || 'pro',
    seatLimit: matchingPlan?.seats || 1,
  });

  console.log('[PayPal Webhook] Subscription activated for team:', teamId);
}

async function handleSubscriptionUpdated(resource: PayPalResource) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    console.error('[PayPal Webhook] No team found for subscription:', resource.id);
    return;
  }

  const status = resource.status?.toLowerCase() || 'active';
  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: status === 'active' ? 'active' : status,
  });

  console.log('[PayPal Webhook] Subscription updated for team:', team.id, 'status:', status);
}

async function handleSubscriptionCanceled(resource: PayPalResource) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    console.error('[PayPal Webhook] No team found for subscription:', resource.id);
    return;
  }

  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: 'canceled',
  });

  console.log('[PayPal Webhook] Subscription canceled for team:', team.id);
}

async function handleSubscriptionSuspended(resource: PayPalResource) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    console.error('[PayPal Webhook] No team found for subscription:', resource.id);
    return;
  }

  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: 'past_due',
  });

  console.log('[PayPal Webhook] Subscription suspended for team:', team.id);
}

async function handlePaymentIssue(resource: PayPalResource) {
  const team = await TeamService.getByPayPalSubscriptionId(resource.id);
  if (!team) {
    console.error('[PayPal Webhook] No team found for subscription:', resource.id);
    return;
  }

  await TeamService.updatePayPalInfo(team.id, {
    subscriptionStatus: 'past_due',
  });

  console.log('[PayPal Webhook] Payment issue for team:', team.id);
}
