import { NextRequest } from 'next/server';
import { successResponse, handleApiError, autoRateLimit } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';
import { db, cliVersions, cliErrorReports } from '@/db';
import { eq, desc, count } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateVersionSchema = z.object({
  status: z.enum(['draft', 'testing', 'stable', 'deprecated', 'blocked']).optional(),
  changelog: z.string().optional(),
  breakingChanges: z.string().optional(),
  isAutoUpdateEnabled: z.boolean().optional(),
  rolloutPercent: z.number().min(0).max(100).optional(),
});

/**
 * GET /api/admin/cli-versions/[id]
 * Get detailed info about a CLI version including error reports
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();
    const { id } = await params;

    const version = await db.query.cliVersions.findFirst({
      where: eq(cliVersions.id, id),
    });

    if (!version) {
      return handleApiError(new Error('Version not found'));
    }

    // Get recent error reports for this version
    const recentErrors = await db.query.cliErrorReports.findMany({
      where: eq(cliErrorReports.cliVersion, version.version),
      orderBy: [desc(cliErrorReports.createdAt)],
      limit: 20,
    });

    // Get error count by type
    const errorsByType = await db
      .select({
        errorType: cliErrorReports.errorType,
        count: count(),
      })
      .from(cliErrorReports)
      .where(eq(cliErrorReports.cliVersion, version.version))
      .groupBy(cliErrorReports.errorType);

    return successResponse({
      version,
      errors: {
        recent: recentErrors,
        byType: errorsByType,
        total: version.errorCount || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/admin/cli-versions/[id]
 * Update CLI version settings or status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();
    const { id } = await params;

    const body = await req.json();
    const data = updateVersionSchema.parse(body);

    // Get current version
    const current = await db.query.cliVersions.findFirst({
      where: eq(cliVersions.id, id),
    });

    if (!current) {
      return handleApiError(new Error('Version not found'));
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.changelog !== undefined) updates.changelog = data.changelog;
    if (data.breakingChanges !== undefined) updates.breakingChanges = data.breakingChanges;
    if (data.isAutoUpdateEnabled !== undefined) updates.isAutoUpdateEnabled = data.isAutoUpdateEnabled;
    if (data.rolloutPercent !== undefined) updates.rolloutPercent = data.rolloutPercent;

    // Handle status transitions
    if (data.status && data.status !== current.status) {
      updates.status = data.status;

      switch (data.status) {
        case 'testing':
          updates.testedBy = session.user.id;
          updates.testedAt = new Date();
          break;
        case 'stable':
          updates.approvedBy = session.user.id;
          updates.stableAt = new Date();
          // When marking as stable, enable auto-update by default
          if (data.isAutoUpdateEnabled === undefined) {
            updates.isAutoUpdateEnabled = true;
          }
          break;
        case 'deprecated':
          updates.deprecatedAt = new Date();
          updates.isAutoUpdateEnabled = false;
          break;
        case 'blocked':
          updates.blockedAt = new Date();
          updates.isAutoUpdateEnabled = false;
          break;
      }
    }

    const [updated] = await db.update(cliVersions)
      .set(updates)
      .where(eq(cliVersions.id, id))
      .returning();

    return successResponse({ version: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/cli-versions/[id]
 * Delete a CLI version entry (only draft versions)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();
    const { id } = await params;

    const version = await db.query.cliVersions.findFirst({
      where: eq(cliVersions.id, id),
    });

    if (!version) {
      return handleApiError(new Error('Version not found'));
    }

    // Only allow deleting draft versions
    if (version.status !== 'draft') {
      return handleApiError(new Error('Can only delete draft versions'));
    }

    await db.delete(cliVersions).where(eq(cliVersions.id, id));

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
