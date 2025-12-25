import { NextRequest } from 'next/server';
import { db, patternGaps, apiKeys, teams } from '@/db';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { ValidationError, AuthenticationError } from '@/lib/errors';
import { eq, and, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pattern-gaps
 * Report a pattern gap from the CLI
 * Uses API key authentication and deduplicates within 7-day window
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Get API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid API key');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Validate API key and get team
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPlain, apiKey))
      .limit(1);

    if (!keyRecord || !keyRecord.isActive) {
      throw new AuthenticationError('Invalid API key');
    }

    // Get request body
    const body = await req.json();
    const { category, request, context, handledWith, wasSuccessful } = body;

    if (!category || !request) {
      throw new ValidationError('category and request are required');
    }

    // Check for duplicate within 7-day window (same category)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [existingGap] = await db
      .select()
      .from(patternGaps)
      .where(
        and(
          eq(patternGaps.category, category),
          gte(patternGaps.createdAt, sevenDaysAgo)
        )
      )
      .limit(1);

    if (existingGap) {
      // Deduplicated - don't create new entry
      return successResponse({
        deduplicated: true,
        existingId: existingGap.id,
        message: 'Pattern gap already reported within 7-day window',
      });
    }

    // Insert new pattern gap
    const [newGap] = await db
      .insert(patternGaps)
      .values({
        category,
        request,
        context,
        handledWith,
        wasSuccessful: wasSuccessful ?? true,
        teamId: keyRecord.teamId,
      })
      .returning();

    return successResponse({
      deduplicated: false,
      id: newGap.id,
      message: 'Pattern gap reported successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/pattern-gaps
 * Get pattern gaps (admin only - handled separately)
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    // This endpoint is for admin viewing - redirect to admin endpoint
    return successResponse({
      message: 'Use /api/admin/pattern-gaps for admin access',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
