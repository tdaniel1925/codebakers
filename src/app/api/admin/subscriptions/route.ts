import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db, teams, profiles } from '@/db';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filtering and pagination
 * Query params: status, plan, provider, search, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');
    const provider = searchParams.get('provider');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build conditions array
    const conditions = [];

    // Only include teams with subscription data
    conditions.push(sql`${teams.subscriptionPlan} IS NOT NULL`);

    if (status) {
      conditions.push(eq(teams.subscriptionStatus, status as 'active' | 'past_due' | 'cancelled' | 'inactive'));
    }

    if (plan) {
      conditions.push(eq(teams.subscriptionPlan, plan as 'beta' | 'pro' | 'team' | 'agency' | 'enterprise'));
    }

    if (provider) {
      conditions.push(eq(teams.paymentProvider, provider as 'stripe' | 'paypal' | 'square'));
    }

    if (search) {
      conditions.push(
        or(
          ilike(teams.name, `%${search}%`),
          ilike(teams.slug, `%${search}%`)
        )
      );
    }

    // Get subscriptions with team owner info
    const subscriptions = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        plan: teams.subscriptionPlan,
        status: teams.subscriptionStatus,
        provider: teams.paymentProvider,
        stripeCustomerId: teams.stripeCustomerId,
        stripeSubscriptionId: teams.stripeSubscriptionId,
        paypalSubscriptionId: teams.paypalSubscriptionId,
        squareSubscriptionId: teams.squareSubscriptionId,
        createdAt: teams.createdAt,
        ownerId: teams.ownerId,
        ownerEmail: profiles.email,
        ownerName: profiles.fullName,
      })
      .from(teams)
      .leftJoin(profiles, eq(teams.ownerId, profiles.id))
      .where(and(...conditions))
      .orderBy(desc(teams.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    // Get stats for filters
    const planStats = await db
      .select({
        plan: teams.subscriptionPlan,
        count: sql<number>`count(*)::int`,
      })
      .from(teams)
      .where(sql`${teams.subscriptionPlan} IS NOT NULL`)
      .groupBy(teams.subscriptionPlan);

    const statusStats = await db
      .select({
        status: teams.subscriptionStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(teams)
      .where(sql`${teams.subscriptionStatus} IS NOT NULL`)
      .groupBy(teams.subscriptionStatus);

    const providerStats = await db
      .select({
        provider: teams.paymentProvider,
        count: sql<number>`count(*)::int`,
      })
      .from(teams)
      .where(sql`${teams.paymentProvider} IS NOT NULL`)
      .groupBy(teams.paymentProvider);

    return successResponse({
      subscriptions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: {
        plans: planStats.filter(p => p.plan).map(p => ({ value: p.plan, count: p.count })),
        statuses: statusStats.filter(s => s.status).map(s => ({ value: s.status, count: s.count })),
        providers: providerStats.filter(p => p.provider).map(p => ({ value: p.provider, count: p.count })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
