import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { createPayPalSubscription } from '@/lib/paypal';
import { TeamService } from '@/services/team-service';
import { PricingService } from '@/services/pricing-service';
import { handleApiError } from '@/lib/api-utils';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Validation schema
const checkoutSchema = z.object({
  plan: z.enum(['pro', 'team', 'agency']),
});

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session) {
      throw new AuthenticationError();
    }

    // Parse and validate body
    const body = await req.json();
    const result = checkoutSchema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(
        'Invalid plan',
        result.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const { plan } = result.data;

    // Get user's team
    const team = await TeamService.getByOwnerId(session.user.id);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get plan details from database
    const planDetails = await PricingService.getPlan(plan);
    if (!planDetails?.paypalPlanId) {
      throw new ValidationError('PayPal plan not configured for this tier');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create PayPal subscription
    const subscription = await createPayPalSubscription({
      planId: planDetails.paypalPlanId,
      teamId: team.id,
      returnUrl: `${appUrl}/api/billing/paypal/callback?teamId=${team.id}&plan=${plan}`,
      cancelUrl: `${appUrl}/billing?canceled=true`,
      email: session.user.email!,
    });

    // Find the approval link
    const approvalLink = subscription.links?.find(
      (link) => link.rel === 'approve'
    );

    if (!approvalLink) {
      throw new Error('Failed to get PayPal approval URL');
    }

    // Store the pending subscription ID
    await TeamService.updatePayPalInfo(team.id, {
      paypalSubscriptionId: subscription.id,
      subscriptionStatus: 'pending',
    });

    return NextResponse.json({ url: approvalLink.href });
  } catch (error) {
    console.error('POST /api/billing/paypal/checkout error:', error);
    return handleApiError(error);
  }
}
