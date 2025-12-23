import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiKeyService } from '@/services/api-key-service';
import { PatternSubmissionService } from '@/services/pattern-submission-service';
import { handleApiError, applyRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Stricter rate limit for submissions: 5 per hour
const submissionRateLimit = { windowMs: 60 * 60 * 1000, maxRequests: 5 };

const submitSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(100).max(50000),
  description: z.string().max(500).optional(),
  basePattern: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  reason: z.string().max(1000).optional(),
  userContext: z.string().max(2000).optional(),
});

/**
 * POST /api/patterns/submit
 * Submit a new pattern for admin review
 * Body: { name, content, description?, basePattern?, category?, reason?, userContext? }
 */
export async function POST(req: NextRequest) {
  try {
    applyRateLimit(req, 'pattern-submit', null, submissionRateLimit);

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

    // Parse and validate body
    const body = await req.json();
    const parseResult = submitSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Submit the pattern
    const submission = await PatternSubmissionService.submit({
      name: data.name,
      content: data.content,
      description: data.description,
      basePattern: data.basePattern,
      category: data.category,
      reason: data.reason,
      userContext: data.userContext,
      teamId: validation.team.id,
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        name: submission.name,
        status: submission.status,
        aiRating: submission.aiRating,
        aiRecommendation: submission.aiRecommendation,
        createdAt: submission.createdAt,
      },
      message:
        submission.aiRecommendation === 'approve'
          ? 'Pattern submitted and recommended for approval. Admin will review shortly.'
          : submission.aiRecommendation === 'review'
            ? 'Pattern submitted for review. Admin will evaluate soon.'
            : 'Pattern submitted but may not meet quality standards. Admin will review.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
