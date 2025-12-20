import { db, subscriptionPricing, PaymentProvider } from '@/db';
import { eq } from 'drizzle-orm';

export interface PlanDetails {
  id: string;
  plan: 'beta' | 'pro' | 'team' | 'agency';
  name: string;
  description: string | null;
  features: string[];
  seats: number;
  priceMonthly: number; // in cents
  priceYearly: number | null;
  stripePriceId: string | null;
  stripeYearlyPriceId: string | null;
  squarePlanId: string | null;
  squareYearlyPlanId: string | null;
  paypalPlanId: string | null;
  paypalYearlyPlanId: string | null;
}

export class PricingService {
  /**
   * Get all active pricing plans
   */
  static async getAllPlans(): Promise<PlanDetails[]> {
    const plans = await db
      .select()
      .from(subscriptionPricing)
      .where(eq(subscriptionPricing.isActive, true))
      .orderBy(subscriptionPricing.displayOrder);

    return plans.map((p) => ({
      id: p.id,
      plan: p.plan,
      name: p.name,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      seats: p.seats,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      stripePriceId: p.stripePriceId,
      stripeYearlyPriceId: p.stripeYearlyPriceId,
      squarePlanId: p.squarePlanId,
      squareYearlyPlanId: p.squareYearlyPlanId,
      paypalPlanId: p.paypalPlanId,
      paypalYearlyPlanId: p.paypalYearlyPlanId,
    }));
  }

  /**
   * Get a specific plan by type
   */
  static async getPlan(planType: 'pro' | 'team' | 'agency'): Promise<PlanDetails | null> {
    const [plan] = await db
      .select()
      .from(subscriptionPricing)
      .where(eq(subscriptionPricing.plan, planType))
      .limit(1);

    if (!plan) return null;

    return {
      id: plan.id,
      plan: plan.plan,
      name: plan.name,
      description: plan.description,
      features: plan.features ? JSON.parse(plan.features) : [],
      seats: plan.seats,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      stripePriceId: plan.stripePriceId,
      stripeYearlyPriceId: plan.stripeYearlyPriceId,
      squarePlanId: plan.squarePlanId,
      squareYearlyPlanId: plan.squareYearlyPlanId,
      paypalPlanId: plan.paypalPlanId,
      paypalYearlyPlanId: plan.paypalYearlyPlanId,
    };
  }

  /**
   * Get provider-specific plan ID
   */
  static async getProviderPlanId(
    planType: 'pro' | 'team' | 'agency',
    provider: PaymentProvider,
    yearly: boolean = false
  ): Promise<string | null> {
    const plan = await this.getPlan(planType);
    if (!plan) return null;

    switch (provider) {
      case 'stripe':
        return yearly ? plan.stripeYearlyPriceId : plan.stripePriceId;
      case 'square':
        return yearly ? plan.squareYearlyPlanId : plan.squarePlanId;
      case 'paypal':
        return yearly ? plan.paypalYearlyPlanId : plan.paypalPlanId;
      default:
        return null;
    }
  }

  /**
   * Update a pricing plan
   */
  static async updatePlan(
    planType: 'pro' | 'team' | 'agency',
    data: Partial<{
      name: string;
      description: string;
      features: string[];
      seats: number;
      priceMonthly: number;
      priceYearly: number;
      stripePriceId: string;
      stripeYearlyPriceId: string;
      squarePlanId: string;
      squareYearlyPlanId: string;
      paypalPlanId: string;
      paypalYearlyPlanId: string;
      isActive: boolean;
      displayOrder: number;
    }>
  ) {
    const updates: Record<string, unknown> = { ...data };
    if (data.features) {
      updates.features = JSON.stringify(data.features);
    }
    updates.updatedAt = new Date();

    const [plan] = await db
      .update(subscriptionPricing)
      .set(updates)
      .where(eq(subscriptionPricing.plan, planType))
      .returning();

    return plan;
  }

  /**
   * Create or update a pricing plan (upsert)
   */
  static async upsertPlan(data: {
    plan: 'pro' | 'team' | 'agency';
    name: string;
    description?: string;
    features?: string[];
    seats: number;
    priceMonthly: number;
    priceYearly?: number;
    stripePriceId?: string;
    stripeYearlyPriceId?: string;
    squarePlanId?: string;
    squareYearlyPlanId?: string;
    paypalPlanId?: string;
    paypalYearlyPlanId?: string;
    displayOrder?: number;
  }) {
    const existing = await this.getPlan(data.plan);

    if (existing) {
      return this.updatePlan(data.plan, data);
    }

    const [plan] = await db
      .insert(subscriptionPricing)
      .values({
        plan: data.plan,
        name: data.name,
        description: data.description || null,
        features: data.features ? JSON.stringify(data.features) : null,
        seats: data.seats,
        priceMonthly: data.priceMonthly,
        priceYearly: data.priceYearly || null,
        stripePriceId: data.stripePriceId || null,
        stripeYearlyPriceId: data.stripeYearlyPriceId || null,
        squarePlanId: data.squarePlanId || null,
        squareYearlyPlanId: data.squareYearlyPlanId || null,
        paypalPlanId: data.paypalPlanId || null,
        paypalYearlyPlanId: data.paypalYearlyPlanId || null,
        displayOrder: data.displayOrder || 0,
        isActive: true,
      })
      .returning();

    return plan;
  }

  /**
   * Format price for display (cents to dollars)
   */
  static formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
  }
}
