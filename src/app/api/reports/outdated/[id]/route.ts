import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db, moduleReports } from '@/db';
import { eq } from 'drizzle-orm';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const { status, fixedInVersion } = await req.json();

    if (!status || !['pending', 'acknowledged', 'fixed', 'dismissed'].includes(status)) {
      return successResponse({ error: 'Invalid status' }, 400);
    }

    const updates: Record<string, unknown> = { status };

    if (status === 'acknowledged') {
      updates.acknowledgedAt = new Date();
    } else if (status === 'fixed') {
      updates.fixedAt = new Date();
      if (fixedInVersion) {
        updates.fixedInVersion = fixedInVersion;
      }
    }

    const [updated] = await db
      .update(moduleReports)
      .set(updates)
      .where(eq(moduleReports.id, id))
      .returning();

    if (!updated) {
      return successResponse({ error: 'Report not found' }, 404);
    }

    return successResponse({ report: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;

    const [deleted] = await db
      .delete(moduleReports)
      .where(eq(moduleReports.id, id))
      .returning();

    if (!deleted) {
      return successResponse({ error: 'Report not found' }, 404);
    }

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
