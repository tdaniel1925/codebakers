import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS } from '@/lib/stripe';
import { TeamService } from '@/services/team-service';
import { db, teams } from '@/db';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { subscriptionPlanSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const teamId = session.metadata?.teamId;
        const planResult = subscriptionPlanSchema.safeParse(session.metadata?.plan);

        if (!teamId) {
          console.error('[Stripe Webhook] Missing teamId in session metadata');
          break;
        }

        if (!planResult.success) {
          console.error('[Stripe Webhook] Invalid plan in session metadata:', session.metadata?.plan);
          break;
        }

        const plan = planResult.data;
        const seatLimit = PLANS[plan].seats;

        await TeamService.updateStripeInfo(teamId, {
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: 'active',
          subscriptionPlan: plan,
          seatLimit,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const [team] = await db
          .select()
          .from(teams)
          .where(eq(teams.stripeCustomerId, customerId))
          .limit(1);

        if (team) {
          await TeamService.updateStripeInfo(team.id, {
            subscriptionStatus: subscription.status,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const [team] = await db
          .select()
          .from(teams)
          .where(eq(teams.stripeCustomerId, customerId))
          .limit(1);

        if (team) {
          await TeamService.updateStripeInfo(team.id, {
            subscriptionStatus: 'canceled',
            subscriptionPlan: undefined,
            stripeSubscriptionId: undefined,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const [team] = await db
          .select()
          .from(teams)
          .where(eq(teams.stripeCustomerId, customerId))
          .limit(1);

        if (team) {
          await TeamService.updateStripeInfo(team.id, {
            subscriptionStatus: 'past_due',
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
