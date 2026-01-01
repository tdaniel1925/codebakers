import { NextRequest, NextResponse } from 'next/server';
import { verifySquareWebhook } from '@/lib/square';
import { TeamService } from '@/services/team-service';
import { logger, getRequestId } from '@/lib/logger';

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
  const requestId = getRequestId(req.headers);

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
      logger.error('Square Webhook: Signature verification failed', { requestId });
      return NextResponse.json(
        { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
        { status: 401 }
      );
    }

    const event: SquareWebhookEvent = JSON.parse(body);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event.data.object.subscription, requestId);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data.object.subscription, requestId);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.data.object.subscription, requestId);
        break;

      case 'invoice.payment_made':
        // Payment successful - subscription should already be active
        logger.info('Square Webhook: Invoice payment made', { requestId, eventId: event.event_id });
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object.subscription, requestId);
        break;

      default:
        logger.info(`Square Webhook: Unhandled event ${event.type}`, { requestId, eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Square Webhook: Processing error', { requestId }, error instanceof Error ? error : undefined);
    // Always return 200 to prevent retries for processing errors
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Event handlers
async function handleSubscriptionCreated(subscription: SquareSubscription | undefined, requestId: string) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    logger.error('Square Webhook: No team found for customer', { requestId, customerId: subscription.customer_id });
    return;
  }

  await TeamService.updateSquareInfo(team.id, {
    squareSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status.toLowerCase() === 'active' ? 'active' : 'pending',
  });

  logger.billingEvent('Subscription created', team.id, requestId, { subscriptionId: subscription.id });
}

async function handleSubscriptionUpdated(subscription: SquareSubscription | undefined, requestId: string) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    logger.error('Square Webhook: No team found for customer', { requestId, customerId: subscription.customer_id });
    return;
  }

  const status = subscription.status.toLowerCase();
  await TeamService.updateSquareInfo(team.id, {
    squareSubscriptionId: subscription.id,
    subscriptionStatus: status === 'active' ? 'active' : status,
  });

  logger.billingEvent('Subscription updated', team.id, requestId, { status });
}

async function handleSubscriptionCanceled(subscription: SquareSubscription | undefined, requestId: string) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    logger.error('Square Webhook: No team found for customer', { requestId, customerId: subscription.customer_id });
    return;
  }

  await TeamService.updateSquareInfo(team.id, {
    subscriptionStatus: 'canceled',
  });

  logger.billingEvent('Subscription canceled', team.id, requestId);
}

async function handlePaymentFailed(subscription: SquareSubscription | undefined, requestId: string) {
  if (!subscription) return;

  const team = await TeamService.getBySquareCustomerId(subscription.customer_id);
  if (!team) {
    logger.error('Square Webhook: No team found for customer', { requestId, customerId: subscription.customer_id });
    return;
  }

  await TeamService.updateSquareInfo(team.id, {
    subscriptionStatus: 'past_due',
  });

  logger.billingEvent('Payment failed', team.id, requestId);
}
