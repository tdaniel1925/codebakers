import { NextRequest } from 'next/server';
import { db, cliAnalytics, apiKeys } from '@/db';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cli/analytics
 * Track CLI analytics events (triggers, learned topics, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Get API key from Authorization header (optional - anonymous tracking allowed)
    const authHeader = req.headers.get('Authorization');
    let teamId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.replace('Bearer ', '');
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyPlain, apiKey))
        .limit(1);

      if (keyRecord?.isActive) {
        teamId = keyRecord.teamId;
      }
    }

    // Get request body
    const body = await req.json();
    const { eventType, eventData, projectHash } = body;

    if (!eventType) {
      throw new ValidationError('eventType is required');
    }

    // Validate eventType
    const validEventTypes = [
      'trigger_fired',
      'trigger_accepted',
      'trigger_dismissed',
      'topic_learned',
      'command_used',
      'pattern_fetched',
      'build_started',
      'build_completed',
      'feature_added',
      'audit_run',
      'design_cloned',
    ];

    if (!validEventTypes.includes(eventType)) {
      throw new ValidationError(
        `Invalid eventType. Valid types: ${validEventTypes.join(', ')}`
      );
    }

    // Insert analytics event
    const [newEvent] = await db
      .insert(cliAnalytics)
      .values({
        eventType,
        eventData: eventData ? JSON.stringify(eventData) : null,
        teamId,
        projectHash,
      })
      .returning();

    return successResponse({
      id: newEvent.id,
      message: 'Analytics event recorded',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
