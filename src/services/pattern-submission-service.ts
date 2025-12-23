import { db, patternSubmissions, profiles, teams } from '@/db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { createMessage } from '@/lib/anthropic';
import type { NewPatternSubmission, PatternSubmission } from '@/db/schema';

interface AIAnalysisResult {
  summary: string;
  rating: number;
  recommendation: 'approve' | 'review' | 'reject';
  analysis: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    duplicateRisk: string;
    productionReady: boolean;
  };
}

interface SubmitPatternInput {
  name: string;
  content: string;
  description?: string;
  basePattern?: string;
  category?: string;
  reason?: string;
  userContext?: string;
  teamId?: string;
}

export class PatternSubmissionService {
  /**
   * Analyze a pattern using AI and return a structured analysis
   */
  static async analyzePattern(
    name: string,
    content: string,
    context?: { basePattern?: string; reason?: string; userContext?: string }
  ): Promise<AIAnalysisResult> {
    const systemPrompt = `You are an expert code reviewer for CodeBakers, a prompt pattern library for AI IDEs.
Your job is to evaluate submitted patterns for quality, usefulness, and production-readiness.

Analyze the submitted pattern and provide:
1. A brief summary (2-3 sentences) for admin review
2. A rating from 1-10 based on:
   - Code quality and best practices (2 points)
   - Error handling and edge cases (2 points)
   - Documentation and clarity (2 points)
   - Usefulness and reusability (2 points)
   - Production readiness (2 points)
3. A recommendation: "approve" (8+), "review" (5-7), or "reject" (1-4)
4. Detailed analysis including strengths, weaknesses, and suggestions

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief 2-3 sentence summary for admin",
  "rating": 7,
  "recommendation": "review",
  "analysis": {
    "strengths": ["Good error handling", "Well documented"],
    "weaknesses": ["Missing edge case for X"],
    "suggestions": ["Add rate limiting example"],
    "duplicateRisk": "Low - unique integration not covered elsewhere",
    "productionReady": true
  }
}`;

    const userPrompt = `Analyze this pattern submission:

**Pattern Name:** ${name}
${context?.basePattern ? `**Based On:** ${context.basePattern}` : ''}
${context?.reason ? `**Reason for Submission:** ${context.reason}` : ''}
${context?.userContext ? `**User Context:** ${context.userContext}` : ''}

**Pattern Content:**
\`\`\`markdown
${content}
\`\`\`

Provide your analysis as JSON only.`;

    try {
      const response = await createMessage({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const contentBlock = response.content[0];
      const text = contentBlock.type === 'text' ? contentBlock.text : '';

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]) as AIAnalysisResult;

      // Validate the response structure
      if (
        typeof analysis.summary !== 'string' ||
        typeof analysis.rating !== 'number' ||
        !['approve', 'review', 'reject'].includes(analysis.recommendation)
      ) {
        throw new Error('Invalid AI response structure');
      }

      return analysis;
    } catch (error) {
      console.error('AI analysis failed:', error);
      // Return a default "review" response if AI fails
      return {
        summary: 'AI analysis failed - manual review required.',
        rating: 5,
        recommendation: 'review',
        analysis: {
          strengths: [],
          weaknesses: ['AI analysis unavailable'],
          suggestions: ['Manual review recommended'],
          duplicateRisk: 'Unknown',
          productionReady: false,
        },
      };
    }
  }

  /**
   * Submit a new pattern for admin review
   */
  static async submit(input: SubmitPatternInput): Promise<PatternSubmission> {
    // Run AI analysis
    const analysis = await this.analyzePattern(input.name, input.content, {
      basePattern: input.basePattern,
      reason: input.reason,
      userContext: input.userContext,
    });

    // Create the submission
    const [submission] = await db
      .insert(patternSubmissions)
      .values({
        name: input.name,
        content: input.content,
        description: input.description,
        basePattern: input.basePattern,
        category: input.category,
        reason: input.reason,
        userContext: input.userContext,
        aiSummary: analysis.summary,
        aiRating: analysis.rating,
        aiRecommendation: analysis.recommendation,
        aiAnalysis: JSON.stringify(analysis.analysis),
        submittedByTeamId: input.teamId,
        status: 'pending',
      })
      .returning();

    return submission;
  }

  /**
   * List all pending submissions for admin review
   */
  static async listPending(options?: { limit?: number; offset?: number }) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const submissions = await db
      .select({
        id: patternSubmissions.id,
        name: patternSubmissions.name,
        description: patternSubmissions.description,
        category: patternSubmissions.category,
        basePattern: patternSubmissions.basePattern,
        reason: patternSubmissions.reason,
        aiSummary: patternSubmissions.aiSummary,
        aiRating: patternSubmissions.aiRating,
        aiRecommendation: patternSubmissions.aiRecommendation,
        status: patternSubmissions.status,
        createdAt: patternSubmissions.createdAt,
        submittedByTeam: {
          id: teams.id,
          name: teams.name,
        },
      })
      .from(patternSubmissions)
      .leftJoin(teams, eq(patternSubmissions.submittedByTeamId, teams.id))
      .where(eq(patternSubmissions.status, 'pending'))
      .orderBy(desc(patternSubmissions.aiRating), desc(patternSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patternSubmissions)
      .where(eq(patternSubmissions.status, 'pending'));

    return { submissions, total: count };
  }

  /**
   * Get a single submission with full details
   */
  static async getById(id: string) {
    const [submission] = await db
      .select({
        submission: patternSubmissions,
        submittedByTeam: {
          id: teams.id,
          name: teams.name,
        },
        reviewedByProfile: {
          id: profiles.id,
          fullName: profiles.fullName,
        },
      })
      .from(patternSubmissions)
      .leftJoin(teams, eq(patternSubmissions.submittedByTeamId, teams.id))
      .leftJoin(profiles, eq(patternSubmissions.reviewedBy, profiles.id))
      .where(eq(patternSubmissions.id, id))
      .limit(1);

    if (!submission) return null;

    return {
      ...submission.submission,
      aiAnalysis: submission.submission.aiAnalysis
        ? JSON.parse(submission.submission.aiAnalysis)
        : null,
      submittedByTeam: submission.submittedByTeam,
      reviewedByProfile: submission.reviewedByProfile,
    };
  }

  /**
   * Approve a pattern submission
   */
  static async approve(
    id: string,
    reviewerId: string,
    options?: { adminNotes?: string; addedToVersion?: string }
  ): Promise<PatternSubmission | null> {
    const [updated] = await db
      .update(patternSubmissions)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        adminNotes: options?.adminNotes,
        addedToVersion: options?.addedToVersion,
      })
      .where(eq(patternSubmissions.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Reject a pattern submission
   */
  static async reject(
    id: string,
    reviewerId: string,
    adminNotes?: string
  ): Promise<PatternSubmission | null> {
    const [updated] = await db
      .update(patternSubmissions)
      .set({
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        adminNotes,
      })
      .where(eq(patternSubmissions.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Get submission statistics for admin dashboard
   */
  static async getStats() {
    const [stats] = await db
      .select({
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        approved: sql<number>`count(*) filter (where status = 'approved')::int`,
        rejected: sql<number>`count(*) filter (where status = 'rejected')::int`,
        total: sql<number>`count(*)::int`,
        avgRating: sql<number>`avg(ai_rating)::numeric(3,1)`,
      })
      .from(patternSubmissions);

    return stats;
  }

  /**
   * List all submissions with optional status filter
   */
  static async list(options?: {
    status?: 'pending' | 'approved' | 'rejected';
    limit?: number;
    offset?: number;
  }) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = db
      .select({
        id: patternSubmissions.id,
        name: patternSubmissions.name,
        description: patternSubmissions.description,
        category: patternSubmissions.category,
        aiSummary: patternSubmissions.aiSummary,
        aiRating: patternSubmissions.aiRating,
        aiRecommendation: patternSubmissions.aiRecommendation,
        status: patternSubmissions.status,
        createdAt: patternSubmissions.createdAt,
        reviewedAt: patternSubmissions.reviewedAt,
        addedToVersion: patternSubmissions.addedToVersion,
      })
      .from(patternSubmissions)
      .orderBy(desc(patternSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    if (options?.status) {
      query = query.where(eq(patternSubmissions.status, options.status)) as typeof query;
    }

    const submissions = await query;

    return submissions;
  }
}
