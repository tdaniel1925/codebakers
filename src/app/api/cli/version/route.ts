import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// CLI version info - update these when publishing new CLI versions
const CLI_VERSION_INFO = {
  latest: '1.1.4',
  minSupported: '1.0.0',
  changelog: 'Added CLAUDE.md installation and existing project detection.',
  downloadUrl: 'https://www.npmjs.com/package/@codebakers/cli',
  releaseDate: '2024-12-23',
};

/**
 * GET /api/cli/version
 * Returns CLI version information for update checking
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    return NextResponse.json({
      latest: CLI_VERSION_INFO.latest,
      minSupported: CLI_VERSION_INFO.minSupported,
      changelog: CLI_VERSION_INFO.changelog,
      downloadUrl: CLI_VERSION_INFO.downloadUrl,
      releaseDate: CLI_VERSION_INFO.releaseDate,
      updateCommand: 'npm update -g @codebakers/cli',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
