import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db, teams, subscriptionPricing, paymentEvents } from '@/db';
import { eq, and, gte, sql, count, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Plan pricing (monthly in cents)
const PLAN_PRICES: Record<string, number> = {
  pro: 2900,
  team: 9900,
  agency: 24900,
  enterprise: 99900,
};

/**
 * GET /api/admin/revenue
 * Get revenue statistics and metrics
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    // Get subscription counts by plan and status
    const subscriptionStats = await db
      .select({
        plan: teams.subscriptionPlan,
        status: teams.subscriptionStatus,
        provider: teams.paymentProvider,
        count: count(),
      })
      .from(teams)
      .where(and(
        sql`${teams.subscriptionPlan} IS NOT NULL`,
        sql`${teams.subscriptionStatus} IS NOT NULL`
      ))
      .groupBy(teams.subscriptionPlan, teams.subscriptionStatus, teams.paymentProvider);

    // Calculate MRR from active subscriptions
    let mrr = 0;
    let activeSubscribers = 0;
    const planBreakdown: Record<string, { count: number; revenue: number }> = {};

    subscriptionStats.forEach(stat => {
      if (stat.status === 'active' && stat.plan) {
        const planPrice = PLAN_PRICES[stat.plan] || 0;
        const revenue = planPrice * stat.count;
        mrr += revenue;
        activeSubscribers += stat.count;

        if (!planBreakdown[stat.plan]) {
          planBreakdown[stat.plan] = { count: 0, revenue: 0 };
        }
        planBreakdown[stat.plan].count += stat.count;
        planBreakdown[stat.plan].revenue += revenue;
      }
    });

    // Get provider breakdown
    const providerBreakdown = await db
      .select({
        provider: teams.paymentProvider,
        count: count(),
      })
      .from(teams)
      .where(and(
        eq(teams.subscriptionStatus, 'active'),
        sql`${teams.paymentProvider} IS NOT NULL`
      ))
      .groupBy(teams.paymentProvider);

    // Get recent payment events (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEvents = await db
      .select()
      .from(paymentEvents)
      .where(gte(paymentEvents.createdAt, thirtyDaysAgo))
      .orderBy(desc(paymentEvents.createdAt))
      .limit(50);

    // Calculate event stats
    const eventStats = {
      newSubscriptions: 0,
      cancellations: 0,
      payments: 0,
      refunds: 0,
      totalRevenue: 0,
    };

    recentEvents.forEach(event => {
      switch (event.eventType) {
        case 'subscription_activated':
        case 'subscription_created':
          eventStats.newSubscriptions++;
          break;
        case 'subscription_cancelled':
        case 'subscription_expired':
          eventStats.cancellations++;
          break;
        case 'payment_completed':
          eventStats.payments++;
          if (event.amount) eventStats.totalRevenue += event.amount;
          break;
        case 'payment_refunded':
          eventStats.refunds++;
          if (event.amount) eventStats.totalRevenue -= event.amount;
          break;
      }
    });

    // Get churn rate (cancellations / total active at start of period)
    // This is a simplified calculation
    const churnRate = activeSubscribers > 0
      ? (eventStats.cancellations / (activeSubscribers + eventStats.cancellations) * 100).toFixed(2)
      : '0.00';

    // Get growth rate (new - cancellations / active)
    const netGrowth = eventStats.newSubscriptions - eventStats.cancellations;
    const growthRate = activeSubscribers > 0
      ? (netGrowth / activeSubscribers * 100).toFixed(2)
      : '0.00';

    return successResponse({
      mrr: mrr / 100, // Convert to dollars
      arr: (mrr * 12) / 100, // Annual recurring revenue
      activeSubscribers,
      planBreakdown: Object.entries(planBreakdown).map(([plan, data]) => ({
        plan,
        count: data.count,
        revenue: data.revenue / 100,
      })),
      providerBreakdown: providerBreakdown.map(p => ({
        provider: p.provider || 'unknown',
        count: p.count,
      })),
      thirtyDayStats: {
        newSubscriptions: eventStats.newSubscriptions,
        cancellations: eventStats.cancellations,
        payments: eventStats.payments,
        refunds: eventStats.refunds,
        revenue: eventStats.totalRevenue / 100,
        churnRate: parseFloat(churnRate),
        growthRate: parseFloat(growthRate),
        netGrowth,
      },
      recentEvents: recentEvents.slice(0, 10).map(e => ({
        id: e.id,
        type: e.eventType,
        provider: e.provider,
        amount: e.amount ? e.amount / 100 : null,
        plan: e.plan,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
