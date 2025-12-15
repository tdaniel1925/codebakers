import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { stripe, PRICES } from '@/lib/stripe';
import { TeamService } from '@/services/team-service';
import { handleApiError } from '@/lib/api-utils';
import { checkoutSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = checkoutSchema.parse(body);

    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      return NextResponse.json({ error: 'No team found' }, { status: 404 });
    }

    // Create or get Stripe customer
    let customerId = team.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        metadata: {
          teamId: team.id,
          userId: session.user.id,
        },
      });
      customerId = customer.id;

      await TeamService.updateStripeInfo(team.id, {
        stripeCustomerId: customerId,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: PRICES[plan],
          quantity: 1,
        },
      ],
      metadata: {
        teamId: team.id,
        plan,
      },
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return handleApiError(error);
  }
}
