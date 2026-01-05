import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/services/content-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/patterns/list
 * Returns all available patterns with name, description, and content.
 * Used by the CodeBakers VS Code extension to load patterns.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    applyRateLimit(req, 'api:patterns:list', session.user.id);

    // Get user's team for pinned version
    const team = await TeamService.getByOwnerId(session.user.id);

    // Use team's pinned version if set, otherwise use latest
    const pinnedVersion = team?.pinnedPatternVersion;
    const content = await ContentService.getEncodedContent(pinnedVersion || undefined);

    if (!content.modules) {
      throw new NotFoundError('Patterns');
    }

    // Pattern descriptions for the extension
    const patternDescriptions: Record<string, string> = {
      '00-core': 'Core standards, types, error handling, Zod patterns',
      '01-database': 'Drizzle ORM, queries, migrations',
      '02-auth': 'Authentication, sessions, OAuth, 2FA',
      '03-api': 'API routes, validation, rate limiting',
      '04-frontend': 'React components, forms, state management',
      '05-payments': 'Stripe integration, subscriptions, checkout',
      '06-integrations': 'Third-party integrations',
      '07-performance': 'Caching, optimization, lazy loading',
      '08-testing': 'Playwright, Vitest, CI/CD',
      '09-design': 'UI components, dashboards, design systems',
      '10-generators': 'Scaffolding, templates, code generation',
      '11-realtime': 'WebSockets, live updates, notifications',
      '12-saas': 'Multi-tenant, feature flags, tiers',
      '13-mobile': 'React Native, Expo, mobile patterns',
      '14-ai': 'OpenAI, Anthropic, RAG, embeddings',
    };

    // Build pattern list with content
    const patterns = Object.entries(content.modules).map(([filename, moduleContent]) => {
      const name = filename.replace('.md', '');
      return {
        name,
        description: patternDescriptions[name] || `Pattern module: ${name}`,
        content: moduleContent,
      };
    });

    return successResponse({
      version: content.version,
      patterns,
      total: patterns.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
