import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { ContentService } from '@/services/content-service';
import { TeamService } from '@/services/team-service';
import { AnalyticsService } from '@/services/analytics-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { deobfuscateContent, isObfuscated } from '@/services/obfuscation-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/patterns
 * Returns list of available pattern modules
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    // Use team's pinned version if set, otherwise use latest
    const pinnedVersion = validation.team?.pinnedPatternVersion;
    const content = await ContentService.getEncodedContent(pinnedVersion || undefined);

    // Return list of available patterns (without content)
    const patterns = Object.keys(content.modules || {}).map(name => ({
      name: name.replace('.md', ''),
      filename: name,
    }));

    return NextResponse.json({
      version: content.version,
      patterns,
      total: patterns.length,
      user: validation.ownerName ? { name: validation.ownerName } : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/patterns
 * Fetch specific pattern(s) by name - returns decoded content
 * Body: { patterns: ["00-core", "01-database"] }
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    const body = await req.json();
    const requestedPatterns: string[] = body.patterns || [];

    if (!Array.isArray(requestedPatterns) || requestedPatterns.length === 0) {
      return NextResponse.json(
        { error: 'patterns array is required' },
        { status: 400 }
      );
    }

    // Limit to 5 patterns per request to prevent abuse
    if (requestedPatterns.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 patterns per request' },
        { status: 400 }
      );
    }

    // Use team's pinned version if set, otherwise use latest
    const pinnedVersion = validation.team?.pinnedPatternVersion;
    const content = await ContentService.getEncodedContent(pinnedVersion || undefined);
    const result: Record<string, string> = {};

    for (const pattern of requestedPatterns) {
      // Normalize pattern name
      const filename = pattern.endsWith('.md') ? pattern : `${pattern}.md`;

      if (content.modules && content.modules[filename]) {
        const moduleContent = content.modules[filename];
        // Handle both plain text and legacy encoded content
        result[pattern] = isObfuscated(moduleContent)
          ? deobfuscateContent(moduleContent)
          : moduleContent;
      }
    }

    // Also include router/CLAUDE.md if requested
    if (requestedPatterns.includes('router') || requestedPatterns.includes('CLAUDE')) {
      result['router'] = content.router || content.claudeMd || '';
    }

    // Log pattern usage for analytics (non-blocking)
    const fetchedPatterns = Object.keys(result);
    if (fetchedPatterns.length > 0 && validation.team) {
      AnalyticsService.logPatternFetches(
        validation.team.id,
        fetchedPatterns,
        validation.apiKeyId
      ).catch((err) => {
        console.error('Failed to log pattern usage:', err);
      });
    }

    return NextResponse.json({
      version: content.version,
      patterns: result,
      found: Object.keys(result).length,
      requested: requestedPatterns.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function validateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
    };
  }

  const apiKey = authHeader.slice(7);
  const validation = await ApiKeyService.validate(apiKey);

  if (!validation.valid || !validation.team) {
    return {
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    };
  }

  const { team, ownerName, apiKeyId } = validation;

  // Check access - no project ID for this endpoint (backwards compatible)
  const accessCheck = TeamService.canAccessProject(team, null);

  if (!accessCheck.allowed) {
    const isSuspended = accessCheck.code === 'ACCOUNT_SUSPENDED';
    return {
      error: NextResponse.json(
        {
          error: accessCheck.reason,
          code: accessCheck.code,
          ...(isSuspended
            ? { supportUrl: 'https://www.codebakers.ai/support' }
            : { upgradeUrl: 'https://www.codebakers.ai/dashboard/billing' }),
        },
        { status: isSuspended ? 403 : 402 }
      ),
    };
  }

  return { team, ownerName, apiKeyId };
}
