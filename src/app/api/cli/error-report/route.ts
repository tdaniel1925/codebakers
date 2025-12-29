import { NextRequest } from 'next/server';
import { successResponse, handleApiError, autoRateLimit } from '@/lib/api-utils';
import { db, cliErrorReports, cliVersions } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const errorReportSchema = z.object({
  cliVersion: z.string(),
  nodeVersion: z.string().optional(),
  platform: z.string().optional(),
  errorType: z.string(),
  errorMessage: z.string().optional(),
  errorStack: z.string().optional(),
  command: z.string().optional(),
  deviceHash: z.string().optional(),
});

/**
 * POST /api/cli/error-report
 * Reports CLI errors for tracking and auto-blocking broken versions
 *
 * This is called by the CLI when an error occurs to:
 * 1. Help identify problematic versions
 * 2. Auto-increment error count on versions
 * 3. Alert admins to potential issues
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    const body = await req.json();
    const data = errorReportSchema.parse(body);

    // Get team ID from auth if available
    const authHeader = req.headers.get('authorization');
    let teamId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const { ApiKeyService } = await import('@/services/api-key-service');
      const apiKey = authHeader.slice(7);
      const result = await ApiKeyService.validate(apiKey);
      if (result.valid && result.team) {
        teamId = result.team.id;
      }
    }

    // Insert error report
    await db.insert(cliErrorReports).values({
      cliVersion: data.cliVersion,
      nodeVersion: data.nodeVersion,
      platform: data.platform,
      errorType: data.errorType,
      errorMessage: data.errorMessage,
      errorStack: data.errorStack,
      command: data.command,
      teamId,
      deviceHash: data.deviceHash,
    });

    // Increment error count on the CLI version (if it exists)
    await db.update(cliVersions)
      .set({
        errorCount: sql`${cliVersions.errorCount} + 1`,
        lastErrorAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(cliVersions.version, data.cliVersion));

    return successResponse({ reported: true });
  } catch (error) {
    // Don't fail CLI if error reporting fails
    console.error('CLI error report failed:', error);
    return successResponse({ reported: false });
  }
}
