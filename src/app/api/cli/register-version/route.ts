import { NextRequest } from 'next/server';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { db, cliVersions } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const registerVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in format X.Y.Z'),
  npmTag: z.string().default('latest'),
  features: z.string().optional(),
  changelog: z.string().optional(),
  breakingChanges: z.string().optional(),
  minNodeVersion: z.string().default('18'),
});

/**
 * POST /api/cli/register-version
 * Called automatically after npm publish to register new CLI versions
 * Requires admin API key for authentication
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin API key
    const authHeader = req.headers.get('authorization');
    const adminKey = process.env.CODEBAKERS_ADMIN_KEY;

    if (!adminKey) {
      return handleApiError(new Error('Server not configured for version registration'));
    }

    if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== adminKey) {
      return handleApiError(new Error('Invalid admin key'));
    }

    const body = await req.json();
    const data = registerVersionSchema.parse(body);

    // Check if version already exists
    const existing = await db.query.cliVersions.findFirst({
      where: eq(cliVersions.version, data.version),
    });

    if (existing) {
      return handleApiError(new Error('Version already exists'));
    }

    // Insert new version as draft
    const [newVersion] = await db.insert(cliVersions).values({
      version: data.version,
      npmTag: data.npmTag,
      features: data.features,
      changelog: data.changelog,
      breakingChanges: data.breakingChanges,
      minNodeVersion: data.minNodeVersion,
      status: 'draft',
      publishedAt: new Date(),
    }).returning();

    return successResponse({ version: newVersion });
  } catch (error) {
    return handleApiError(error);
  }
}
