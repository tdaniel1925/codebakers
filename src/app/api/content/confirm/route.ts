import { NextRequest } from 'next/server';
import { successResponse, autoRateLimit } from '@/lib/api-utils';
import { ApiKeyService } from '@/services/api-key-service';
import { db, cliAnalytics } from '@/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  version: z.string(),
  moduleCount: z.number(),
  cliVersion: z.string().optional(),
  projectName: z.string().optional(),
  command: z.enum(['go', 'upgrade', 'setup', 'install', 'auto-update']).optional(),
});

/**
 * POST /api/content/confirm
 * Records that patterns were successfully downloaded
 *
 * This is called by the CLI after patterns are written to disk.
 * Helps track:
 * - Which users have latest patterns
 * - Upgrade adoption rates
 * - CLI version distribution
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    const body = await req.json();
    const data = confirmSchema.parse(body);

    // Get identifier - either API key or trial ID
    const authHeader = req.headers.get('authorization');
    const trialId = req.headers.get('x-trial-id');

    let teamId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const result = await ApiKeyService.validate(apiKey);
      if (result.valid && result.team) {
        teamId = result.team.id;
      }
    }

    // Record the download as a CLI analytics event
    await db.insert(cliAnalytics).values({
      eventType: 'patterns_downloaded',
      eventData: JSON.stringify({
        version: data.version,
        moduleCount: data.moduleCount,
        cliVersion: data.cliVersion,
        projectName: data.projectName,
        command: data.command,
        trialId: trialId || null,
      }),
      teamId,
      projectHash: data.projectName ? Buffer.from(data.projectName).toString('base64').slice(0, 16) : null,
    });

    return successResponse({ confirmed: true });
  } catch (error) {
    // Don't fail the CLI if confirmation fails - just log it
    console.error('Download confirmation failed:', error);
    return successResponse({ confirmed: false });
  }
}
