import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { ContentService } from '@/services/content-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cli/claude-md
 * Returns the CLAUDE.md router file for CLI installation
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Validate API key
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { team } = validation;

    // Check access
    const accessCheck = TeamService.canAccessProject(team, null);
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { error: accessCheck.reason, code: accessCheck.code },
        { status: accessCheck.code === 'ACCOUNT_SUSPENDED' ? 403 : 402 }
      );
    }

    // Get the CLAUDE.md content
    const content = await ContentService.getEncodedContent();
    const claudeMdContent = content.router || content.claudeMd || '';

    if (!claudeMdContent) {
      return NextResponse.json(
        { error: 'CLAUDE.md content not available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      content: claudeMdContent,
      version: content.version,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
