import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { db, cliVersions } from '@/db';
import { eq, desc, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cli/version
 * Returns CLI version information for update checking
 *
 * This is called by the CLI/MCP server to:
 * 1. Check if there's a newer stable version available
 * 2. Check if current version is blocked (critical bug)
 * 3. Get the auto-update target version
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Get the current CLI version from request (if provided)
    const currentVersion = req.headers.get('x-cli-version');

    // Get the stable version (auto-update target)
    const stableVersion = await db.query.cliVersions.findFirst({
      where: and(
        eq(cliVersions.status, 'stable'),
        eq(cliVersions.isAutoUpdateEnabled, true)
      ),
      orderBy: [desc(cliVersions.stableAt)],
    });

    // Get the minimum supported version (oldest non-blocked version)
    const minVersion = await db.query.cliVersions.findFirst({
      where: and(
        eq(cliVersions.status, 'stable'),
      ),
      orderBy: [cliVersions.createdAt], // Oldest first
    });

    // Check if current version is blocked
    let isBlocked = false;
    let blockReason: string | null = null;
    if (currentVersion) {
      const currentVersionRecord = await db.query.cliVersions.findFirst({
        where: eq(cliVersions.version, currentVersion),
      });
      if (currentVersionRecord?.status === 'blocked') {
        isBlocked = true;
        blockReason = currentVersionRecord.breakingChanges || 'This version has a critical bug. Please update.';
      }
    }

    // Fallback to hardcoded values if no database entries exist
    const latest = stableVersion?.version || '1.1.5';
    const minSupported = minVersion?.version || '1.0.0';

    return NextResponse.json({
      // Version info
      latest,
      stable: latest, // Alias for clarity
      minSupported,

      // Update info
      changelog: stableVersion?.changelog || 'Bug fixes and improvements.',
      downloadUrl: 'https://www.npmjs.com/package/@codebakers/cli',
      updateCommand: 'npm update -g @codebakers/cli',

      // Auto-update control
      autoUpdateEnabled: stableVersion?.isAutoUpdateEnabled ?? false,
      autoUpdateVersion: stableVersion?.isAutoUpdateEnabled ? latest : null,

      // Block status (critical bugs)
      isBlocked,
      blockReason,

      // Timestamps
      releaseDate: stableVersion?.stableAt?.toISOString() || stableVersion?.publishedAt?.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
