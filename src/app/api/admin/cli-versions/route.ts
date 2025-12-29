import { NextRequest } from 'next/server';
import { successResponse, handleApiError, autoRateLimit } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';
import { db, cliVersions } from '@/db';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Compare two semantic version strings (e.g., "3.3.4" vs "3.10.0")
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numB - numA; // Descending order (newest first)
  }
  return 0;
}

const createVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in format X.Y.Z'),
  npmTag: z.string().default('latest'),
  features: z.string().optional(),
  changelog: z.string().optional(),
  breakingChanges: z.string().optional(),
  minNodeVersion: z.string().default('18'),
});

/**
 * GET /api/admin/cli-versions
 * List all CLI versions with their status
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const versions = await db.query.cliVersions.findMany();

    // Sort by semantic version (newest first)
    versions.sort((a, b) => compareVersions(a.version, b.version));

    // Get publisher names
    const publisherIds = versions.map(v => v.publishedBy).filter(Boolean) as string[];
    const publishers = publisherIds.length > 0
      ? await db.query.profiles.findMany({
          where: (profiles, { inArray }) => inArray(profiles.id, publisherIds),
        })
      : [];

    const publisherMap = Object.fromEntries(publishers.map(p => [p.id, p]));

    const versionsWithPublishers = versions.map(v => ({
      ...v,
      publisher: v.publishedBy ? {
        name: publisherMap[v.publishedBy]?.fullName || null,
        email: publisherMap[v.publishedBy]?.email || null,
      } : null,
    }));

    return successResponse({ versions: versionsWithPublishers });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/cli-versions
 * Create a new CLI version entry
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const session = await requireAdmin();

    const body = await req.json();
    const data = createVersionSchema.parse(body);

    // Check if version already exists
    const existing = await db.query.cliVersions.findFirst({
      where: eq(cliVersions.version, data.version),
    });

    if (existing) {
      return handleApiError(new Error('Version already exists'));
    }

    const [newVersion] = await db.insert(cliVersions).values({
      version: data.version,
      npmTag: data.npmTag,
      features: data.features,
      changelog: data.changelog,
      breakingChanges: data.breakingChanges,
      minNodeVersion: data.minNodeVersion,
      status: 'draft',
      publishedBy: session.user.id,
      publishedAt: new Date(),
    }).returning();

    return successResponse({ version: newVersion });
  } catch (error) {
    return handleApiError(error);
  }
}
