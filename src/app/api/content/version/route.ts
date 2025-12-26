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

    // Count modules (both .claude and .cursorrules-modules)
    const claudeModuleCount = Object.keys(content.modules || {}).length;
    const cursorModuleCount = Object.keys(content.cursorModules || {}).length;

    return NextResponse.json({
      version: content.version,
      moduleCount: claudeModuleCount + cursorModuleCount,
      claudeModules: claudeModuleCount,
      cursorModules: cursorModuleCount,
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}
