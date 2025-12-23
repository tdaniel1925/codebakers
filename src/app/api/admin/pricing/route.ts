import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { PricingService } from '@/services/pricing-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET - List all pricing plans
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const plans = await PricingService.getAllPlans();
    return successResponse({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}

const upsertPlanSchema = z.object({
  plan: z.enum(['pro', 'team', 'agency', 'enterprise']),
  name: z.string().min(1),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  seats: z.number().min(1),
  priceMonthly: z.number().min(0), // in cents
  priceYearly: z.number().min(0).optional(),
  stripePriceId: z.string().optional(),
  stripeYearlyPriceId: z.string().optional(),
  squarePlanId: z.string().optional(),
  squareYearlyPlanId: z.string().optional(),
  paypalPlanId: z.string().optional(),
  paypalYearlyPlanId: z.string().optional(),
  displayOrder: z.number().optional(),
});

// POST - Create or update a pricing plan
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const body = await req.json();
    const data = upsertPlanSchema.parse(body);

    const plan = await PricingService.upsertPlan(data);

    return successResponse({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}
