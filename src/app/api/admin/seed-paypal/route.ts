import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing-service';

export const dynamic = 'force-dynamic';

// This endpoint seeds PayPal plan IDs into the database
// Protected by checking for admin email or a secret
export async function POST(req: NextRequest) {
  try {
    // Check for admin secret
    const { secret } = await req.json();
    if (secret !== process.env.ENCODER_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = [];

    // Seed Pro plan
    const pro = await PricingService.upsertPlan({
      plan: 'pro',
      name: 'Pro',
      description: 'Perfect for solo developers',
      seats: 1,
      priceMonthly: 4900,
      features: [
        '34 production modules',
        '45,474 lines of patterns',
        'Auto-testing included',
        'Full stack coverage',
        '1 seat',
        'Email support',
      ],
      paypalPlanId: process.env.PAYPAL_PRO_PLAN_ID || undefined,
      displayOrder: 1,
    });
    results.push({ plan: 'pro', id: pro?.id, paypalPlanId: process.env.PAYPAL_PRO_PLAN_ID });

    // Seed Team plan
    const team = await PricingService.upsertPlan({
      plan: 'team',
      name: 'Team',
      description: 'For growing teams',
      seats: 5,
      priceMonthly: 14900,
      features: [
        'Everything in Pro',
        '5 team seats',
        'Team management dashboard',
        'Shared API keys',
        'Priority support',
        'Slack community',
      ],
      paypalPlanId: process.env.PAYPAL_TEAM_PLAN_ID || undefined,
      displayOrder: 2,
    });
    results.push({ plan: 'team', id: team?.id, paypalPlanId: process.env.PAYPAL_TEAM_PLAN_ID });

    // Seed Agency plan
    const agency = await PricingService.upsertPlan({
      plan: 'agency',
      name: 'Agency',
      description: 'For agencies & consultancies',
      seats: -1,
      priceMonthly: 34900,
      features: [
        'Everything in Team',
        'Unlimited seats',
        'White-label support',
        'Custom patterns on request',
        'Dedicated support',
        'Training sessions',
      ],
      paypalPlanId: process.env.PAYPAL_AGENCY_PLAN_ID || undefined,
      displayOrder: 3,
    });
    results.push({ plan: 'agency', id: agency?.id, paypalPlanId: process.env.PAYPAL_AGENCY_PLAN_ID });

    return NextResponse.json({
      success: true,
      message: 'PayPal plans seeded successfully',
      results,
    });
  } catch (error) {
    console.error('Seed PayPal plans error:', error);
    return NextResponse.json(
      { error: 'Failed to seed plans', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
