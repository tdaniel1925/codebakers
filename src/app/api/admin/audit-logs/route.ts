import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db, auditLogs, profiles } from '@/db';
import { eq, and, desc, gte, lte, ilike, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering and pagination
 * Query params: action, resource, userId, dateFrom, dateTo, search, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build conditions
    const conditions = [];

    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    if (resource) {
      conditions.push(eq(auditLogs.resource, resource));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    if (search) {
      conditions.push(
        ilike(auditLogs.userEmail, `%${search}%`)
      );
    }

    // Get logs with user info
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        previousValue: auditLogs.previousValue,
        newValue: auditLogs.newValue,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        userName: profiles.fullName,
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(auditLogs.userId, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // Get unique actions and resources for filters
    const actionStats = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .groupBy(auditLogs.action);

    const resourceStats = await db
      .select({
        resource: auditLogs.resource,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .groupBy(auditLogs.resource);

    return successResponse({
      logs: logs.map((log) => ({
        ...log,
        previousValue: log.previousValue ? JSON.parse(log.previousValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: {
        actions: actionStats.map((a) => ({ value: a.action, count: a.count })),
        resources: resourceStats.map((r) => ({ value: r.resource, count: r.count })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
