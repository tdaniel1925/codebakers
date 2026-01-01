import { NextRequest, NextResponse } from 'next/server';
import { getPayPalSubscription } from '@/lib/paypal';
import { TeamService } from '@/services/team-service';
import { PricingService } from '@/services/pricing-service';
import { TrialService } from '@/services/trial-service';
import { autoRateLimit } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { db, profiles } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    const plan = searchParams.get('plan') as 'pro' | 'team' | 'agency';
    const subscriptionId = searchParams.get('subscription_id');

    if (!teamId || !plan) {
      return NextResponse.redirect(
        new URL('/billing?error=missing_params', req.url)
      );
    }

    const team = await TeamService.getById(teamId);
    if (!team) {
      return NextResponse.redirect(
        new URL('/billing?error=team_not_found', req.url)
      );
    }

    // Get the subscription ID from the team if not in URL
    const subId = subscriptionId || team.paypalSubscriptionId;
    if (!subId) {
      return NextResponse.redirect(
        new URL('/billing?error=no_subscription', req.url)
      );
    }

    // Verify the subscription with PayPal
    const subscription = await getPayPalSubscription(subId);

    if (subscription.status !== 'ACTIVE' && subscription.status !== 'APPROVED') {
      return NextResponse.redirect(
        new URL(`/billing?error=subscription_not_active&status=${subscription.status}`, req.url)
      );
    }

    // Get plan details for seat limit
    const planDetails = await PricingService.getPlan(plan);

    // Update team with active subscription
    await TeamService.updatePayPalInfo(teamId, {
      paypalSubscriptionId: subId,
      subscriptionStatus: 'active',
      subscriptionPlan: plan,
      seatLimit: planDetails?.seats || 1,
    });

    // Mark any associated trial as converted
    if (team.ownerId) {
      const owner = await db.query.profiles.findFirst({
        where: eq(profiles.id, team.ownerId),
      });

      if (owner?.email) {
        const convertedTrial = await TrialService.markAsConverted(teamId, {
          email: owner.email,
        });

        if (convertedTrial) {
          logger.billingEvent('Trial converted to paid', teamId, 'paypal-callback', {
            trialId: convertedTrial.id,
            plan,
          });
        }
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      new URL('/dashboard?success=true&provider=paypal', appUrl)
    );
  } catch (error) {
    logger.error('PayPal callback error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.redirect(
      new URL('/billing?error=callback_failed', req.url)
    );
  }
}
