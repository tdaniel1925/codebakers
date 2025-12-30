import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/services/content-service';
import { autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/content/version
 * Returns the current version and module count without full content
 * This is a lightweight endpoint for version checking
 */
export async function GET(req: NextRequest) {
  autoRateLimit(req);

  try {
    const content = await ContentService.getEncodedContent();

    // Count modules - only .claude/ modules are the main patterns
    // .cursorrules-modules is a legacy/separate feature
    const claudeModuleCount = Object.keys(content.modules || {}).length;

    return NextResponse.json({
      version: content.version,
      moduleCount: claudeModuleCount, // Primary module count (.claude/ folder)
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}
