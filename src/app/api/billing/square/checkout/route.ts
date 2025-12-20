import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { createSquareCustomer, createSquareSubscription } from '@/lib/square';
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
    if (!planDetails?.squarePlanId) {
      throw new ValidationError('Square plan not configured for this tier');
    }

    // Create or get Square customer
    let customerId: string = team.squareCustomerId || '';
    if (!customerId) {
      const customer = await createSquareCustomer(session.user.email!, team.id);
      if (!customer?.id) {
        throw new Error('Failed to create Square customer');
      }
      customerId = customer.id;

      await TeamService.updateSquareInfo(team.id, {
        squareCustomerId: customerId,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create subscription directly (Square doesn't use hosted checkout for subscriptions)
    const subscription = await createSquareSubscription({
      customerId,
      planVariationId: planDetails.squarePlanId,
      teamId: team.id,
    });

    if (!subscription?.id) {
      throw new Error('Failed to create Square subscription');
    }

    // Update team with subscription info
    await TeamService.updateSquareInfo(team.id, {
      squareSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status?.toLowerCase() || 'pending',
      subscriptionPlan: plan,
      seatLimit: planDetails.seats,
    });

    // Return success with redirect URL
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      redirectUrl: `${appUrl}/dashboard?success=true&provider=square`,
    });
  } catch (error) {
    console.error('POST /api/billing/square/checkout error:', error);
    return handleApiError(error);
  }
}
