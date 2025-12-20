import { NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing-service';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET - Get public pricing info (no auth required)
export async function GET() {
  try {
    const plans = await PricingService.getAllPlans();

    // Return only public-facing info (no provider-specific IDs)
    const publicPlans = plans.map((plan) => ({
      plan: plan.plan,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      seats: plan.seats,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      // Indicate which providers are available
      providers: {
        stripe: !!plan.stripePriceId,
        square: !!plan.squarePlanId,
        paypal: !!plan.paypalPlanId,
      },
    }));

    return NextResponse.json({ plans: publicPlans });
  } catch (error) {
    return handleApiError(error);
  }
}
