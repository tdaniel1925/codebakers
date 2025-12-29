import { NextRequest } from 'next/server';
import { successResponse, handleApiError, autoRateLimit } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';
import { db, cliVersions } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface NpmVersionInfo {
  version: string;
  time: string;
}

/**
 * POST /api/admin/cli-versions/import-npm
 * Import all versions from npm registry
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();

    // Fetch all versions from npm
    const npmResponse = await fetch('https://registry.npmjs.org/@codebakers/cli');
    if (!npmResponse.ok) {
      throw new Error('Failed to fetch from npm registry');
    }

    const npmData = await npmResponse.json();
    const versions = Object.keys(npmData.versions || {});
    const times = npmData.time || {};

    // Get existing versions from database
    const existingVersions = await db.query.cliVersions.findMany({
      columns: { version: true },
    });
    const existingSet = new Set(existingVersions.map(v => v.version));

    // Filter to only new versions
    const newVersions = versions.filter(v => !existingSet.has(v));

    if (newVersions.length === 0) {
      return successResponse({
        imported: 0,
        message: 'All versions already imported',
        total: versions.length,
      });
    }

    // Insert new versions
    const toInsert = newVersions.map(version => {
      const publishedAt = times[version] ? new Date(times[version]) : new Date();

      // Determine status based on version
      const isLatest = version === npmData['dist-tags']?.latest;
      const isBeta = version.includes('beta') || version.includes('alpha');

      return {
        version,
        npmTag: isLatest ? 'latest' : isBeta ? 'beta' : 'latest',
        status: isLatest ? 'stable' as const : 'draft' as const,
        minNodeVersion: '18',
        publishedBy: session.user.id,
        publishedAt,
        isAutoUpdateEnabled: isLatest, // Only latest gets auto-update
      };
    });

    await db.insert(cliVersions).values(toInsert);

    return successResponse({
      imported: newVersions.length,
      versions: newVersions,
      total: versions.length,
      latest: npmData['dist-tags']?.latest,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
