import { NextRequest, NextResponse } from 'next/server';
import { verifySquareWebhook } from '@/lib/square';
import { TeamService } from '@/services/team-service';

export const dynamic = 'force-dynamic';

interface SquareSubscription {
  id: string;
  customer_id: string;
  plan_variation_id: string;
  status: string;
  canceled_date?: string;
}

interface SquareWebhookEvent {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: {
      subscription?: SquareSubscription;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    // Get signature header
    const signature = req.headers.get('x-square-hmacsha256-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature', code: 'MISSING_SIGNATURE' },
        { status: 401 }
      );
    }

    const body = await req.text();

    // Verify webhook signature
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/square`;
    const isValid = verifySquareWebhook(signature, body, webhookUrl);

    if (!isValid) {
      console.error('[Square Webhook] Signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
        { status: 401 }
      );
    }

    const event: SquareWebhookEvent = JSON.parse(body);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event.data.object.subscription);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data.object.subscription);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.data.object.subscription);
        break;

      case 'invoice.payment_made':
        // Payment successful - subscription should already be active
        console.log('[Square Webhook] Invoice payment made:', event.event_id);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object.subscription);
        break;

      default:
        console.log(`[Square Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Square Webhook] Processing error:', error);
    // Always return 200 to prevent retries for processing errors
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Event handlers
async function handleSubscriptionCreated(subscription: SquareSubscription | undefined) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    console.error('[Square Webhook] No team found for customer:', subscription.customer_id);
    return;
  }

  await TeamService.updateSquareInfo(team.id, {
    squareSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status.toLowerCase() === 'active' ? 'active' : 'pending',
  });

  console.log('[Square Webhook] Subscription created for team:', team.id);
}

async function handleSubscriptionUpdated(subscription: SquareSubscription | undefined) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    console.error('[Square Webhook] No team found for customer:', subscription.customer_id);
    return;
  }

  const status = subscription.status.toLowerCase();
  await TeamService.updateSquareInfo(team.id, {
    squareSubscriptionId: subscription.id,
    subscriptionStatus: status === 'active' ? 'active' : status,
  });

  console.log('[Square Webhook] Subscription updated for team:', team.id, 'status:', status);
}

async function handleSubscriptionCanceled(subscription: SquareSubscription | undefined) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    console.error('[Square Webhook] No team found for customer:', subscription.customer_id);
    return;
  }

  await TeamService.updateSquareInfo(team.id, {
    subscriptionStatus: 'canceled',
  });

  console.log('[Square Webhook] Subscription canceled for team:', team.id);
}

async function handlePaymentFailed(subscription: SquareSubscription | undefined) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    console.error('[Square Webhook] No team found for customer:', subscription.customer_id);
    return;
  }

  await TeamService.updateSquareInfo(team.id, {
    subscriptionStatus: 'past_due',
  });

  console.log('[Square Webhook] Payment failed for team:', team.id);
}
