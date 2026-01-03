import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db, paymentEvents, teams, profiles } from '@/db';
import { eq, and, sql, desc, gte, lte, or, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payments
 * List all payment events with filtering and pagination
 * Query params: eventType, provider, dateFrom, dateTo, search, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('eventType');
    const provider = searchParams.get('provider');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build conditions array
    const conditions = [];

    if (eventType) {
      conditions.push(eq(paymentEvents.eventType, eventType as typeof paymentEvents.eventType.enumValues[number]));
    }

    if (provider) {
      conditions.push(eq(paymentEvents.provider, provider as 'stripe' | 'paypal' | 'square'));
    }

    if (dateFrom) {
      conditions.push(gte(paymentEvents.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(paymentEvents.createdAt, endDate));
    }

    // Get payment events with team and profile info
    const events = await db
      .select({
        id: paymentEvents.id,
        eventType: paymentEvents.eventType,
        provider: paymentEvents.provider,
        providerEventId: paymentEvents.providerEventId,
        amount: paymentEvents.amount,
        currency: paymentEvents.currency,
        plan: paymentEvents.plan,
        metadata: paymentEvents.metadata,
        createdAt: paymentEvents.createdAt,
        teamId: paymentEvents.teamId,
        teamName: teams.name,
        teamSlug: teams.slug,
        profileId: paymentEvents.profileId,
        profileEmail: profiles.email,
        profileName: profiles.fullName,
      })
      .from(paymentEvents)
      .leftJoin(teams, eq(paymentEvents.teamId, teams.id))
      .leftJoin(profiles, eq(paymentEvents.profileId, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(paymentEvents.createdAt))
      .limit(limit)
      .offset(offset);

    // Apply search filter in JavaScript (to search across team/profile names)
    let filteredEvents = events;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredEvents = events.filter(
        (e) =>
          e.teamName?.toLowerCase().includes(searchLower) ||
          e.teamSlug?.toLowerCase().includes(searchLower) ||
          e.profileEmail?.toLowerCase().includes(searchLower) ||
          e.profileName?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // Get event type stats
    const eventTypeStats = await db
      .select({
        eventType: paymentEvents.eventType,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`COALESCE(SUM(${paymentEvents.amount}), 0)::int`,
      })
      .from(paymentEvents)
      .groupBy(paymentEvents.eventType);

    // Get provider stats
    const providerStats = await db
      .select({
        provider: paymentEvents.provider,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentEvents)
      .groupBy(paymentEvents.provider);

    // Get recent summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSummary = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${paymentEvents.eventType} = 'payment_completed' THEN ${paymentEvents.amount} ELSE 0 END), 0)::int`,
        totalRefunds: sql<number>`COALESCE(SUM(CASE WHEN ${paymentEvents.eventType} = 'payment_refunded' THEN ${paymentEvents.amount} ELSE 0 END), 0)::int`,
      })
      .from(paymentEvents)
      .where(gte(paymentEvents.createdAt, thirtyDaysAgo));

    return successResponse({
      events: filteredEvents.map((e) => ({
        ...e,
        amount: e.amount ? e.amount / 100 : null, // Convert cents to dollars
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        eventTypes: eventTypeStats.map((e) => ({
          type: e.eventType,
          count: e.count,
          totalAmount: e.totalAmount / 100,
        })),
        providers: providerStats.map((p) => ({
          provider: p.provider,
          count: p.count,
        })),
        thirtyDaySummary: {
          totalEvents: recentSummary[0]?.totalEvents || 0,
          totalRevenue: (recentSummary[0]?.totalRevenue || 0) / 100,
          totalRefunds: (recentSummary[0]?.totalRefunds || 0) / 100,
          netRevenue: ((recentSummary[0]?.totalRevenue || 0) - (recentSummary[0]?.totalRefunds || 0)) / 100,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
