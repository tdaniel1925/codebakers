/**
 * SCOPER AGENT SERVICE
 *
 * The conversational agent that understands user intent.
 * Uses confidence scoring to determine when to ask questions.
 *
 * Key principles:
 * - If confidence < 80% on ANY critical field, ASK the user
 * - Never assume business type, users, or core features
 * - Confirm understanding before proceeding
 */

import { createMessage } from '@/lib/anthropic';
import {
  ConfidenceScore,
  ScopingResult,
  ClarificationQuestion,
} from '@/lib/safety-types';

// =============================================================================
// CONFIDENCE THRESHOLDS
// =============================================================================

const CONFIDENCE_THRESHOLDS = {
  // Critical fields - must be > 80% to proceed
  businessType: 80,
  targetUsers: 80,
  coreFeature: 80,
  hasPayments: 70,

  // Important fields - should be > 60%
  hasAuth: 60,
  hasRealtime: 60,
  scale: 50,

  // Optional fields - can proceed with low confidence
  compliance: 30,
  timeline: 30,
};

// =============================================================================
// SCOPER AGENT SERVICE
// =============================================================================

export class ScoperAgentService {
  /**
   * Analyze user input and determine confidence levels
   */
  static async analyzeIntent(userInput: string): Promise<ScopingResult> {
    // Use AI to extract entities and confidence
    const analysis = await this.extractWithConfidence(userInput);

    // Calculate overall confidence
    const criticalScores = analysis.scores.filter(s =>
      ['businessType', 'targetUsers', 'coreFeature'].includes(s.field)
    );
    const overallConfidence = criticalScores.length > 0
      ? Math.min(...criticalScores.map(s => s.confidence))
      : 0;

    // Generate clarification questions for low-confidence fields
    const clarificationQuestions = this.generateClarificationQuestions(analysis.scores);

    // Determine if ready to proceed
    const readyToProceed = clarificationQuestions.filter(q => q.required).length === 0;

    return {
      scores: analysis.scores,
      overallConfidence,
      clarificationQuestions,
      readyToProceed,
    };
  }

  /**
   * Process user's answer to a clarification question
   */
  static async processAnswer(
    currentScores: ConfidenceScore[],
    questionId: string,
    answer: string
  ): Promise<ScopingResult> {
    // Update the relevant score
    const updatedScores = currentScores.map(score => {
      if (score.field === questionId) {
        return {
          ...score,
          value: answer,
          confidence: 95, // User explicitly answered
          needsClarification: false,
          reasoning: 'User provided explicit answer',
        };
      }
      return score;
    });

    // Recalculate clarification questions
    const clarificationQuestions = this.generateClarificationQuestions(updatedScores);

    // Calculate overall confidence
    const criticalScores = updatedScores.filter(s =>
      ['businessType', 'targetUsers', 'coreFeature'].includes(s.field)
    );
    const overallConfidence = criticalScores.length > 0
      ? Math.min(...criticalScores.map(s => s.confidence))
      : 0;

    const readyToProceed = clarificationQuestions.filter(q => q.required).length === 0;

    return {
      scores: updatedScores,
      overallConfidence,
      clarificationQuestions,
      readyToProceed,
    };
  }

  /**
   * Generate a confirmation summary for user approval
   */
  static generateConfirmationSummary(scores: ConfidenceScore[]): string {
    const getValue = (field: string): string => {
      const score = scores.find(s => s.field === field);
      return score?.value as string || 'Not specified';
    };

    const lines: string[] = [
      '## Here\'s what I understand:',
      '',
      `**Business:** ${getValue('businessType')}`,
      `**Users:** ${getValue('targetUsers')}`,
      `**Core Feature:** ${getValue('coreFeature')}`,
      '',
    ];

    // Add optional features
    const hasPayments = scores.find(s => s.field === 'hasPayments')?.value;
    const hasAuth = scores.find(s => s.field === 'hasAuth')?.value;
    const hasRealtime = scores.find(s => s.field === 'hasRealtime')?.value;

    lines.push('**Features:**');
    if (hasPayments) lines.push('- 💳 Payments (Stripe)');
    if (hasAuth) lines.push('- 🔐 User accounts');
    if (hasRealtime) lines.push('- ⚡ Real-time updates');

    lines.push('');
    lines.push('**Is this correct?** (yes / no / adjust)');

    return lines.join('\n');
  }

  /**
   * Format the scoping conversation for AI prompt
   */
  static formatScopingPrompt(scores: ConfidenceScore[]): string {
    const lines: string[] = [
      '## CONFIRMED PROJECT SCOPE',
      '',
    ];

    for (const score of scores) {
      if (score.confidence >= 70) {
        lines.push(`**${score.field}:** ${score.value}`);
      }
    }

    return lines.join('\n');
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Use AI to extract entities with confidence scores
   */
  private static async extractWithConfidence(userInput: string): Promise<{
    scores: ConfidenceScore[];
  }> {
    try {
      const response = await createMessage({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an intent analyzer. Given a user's project description, extract information and rate your confidence.

For each field, provide:
- value: What you think the answer is
- confidence: 0-100 how certain you are
- reasoning: Why you're confident or not

IMPORTANT: If something is not mentioned or unclear, confidence should be LOW (0-40).
Only high confidence (80+) if explicitly stated.

Output JSON only, no explanation:
{
  "businessType": { "value": "...", "confidence": 0-100, "reasoning": "..." },
  "targetUsers": { "value": "...", "confidence": 0-100, "reasoning": "..." },
  "coreFeature": { "value": "...", "confidence": 0-100, "reasoning": "..." },
  "hasPayments": { "value": true/false/null, "confidence": 0-100, "reasoning": "..." },
  "hasAuth": { "value": true/false/null, "confidence": 0-100, "reasoning": "..." },
  "hasRealtime": { "value": true/false/null, "confidence": 0-100, "reasoning": "..." },
  "scale": { "value": "small/medium/large/enterprise/null", "confidence": 0-100, "reasoning": "..." },
  "compliance": { "value": ["hipaa", "pci", etc] or [], "confidence": 0-100, "reasoning": "..." }
}`,
        messages: [{
          role: 'user',
          content: `Analyze this project request: "${userInput}"`,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return { scores: this.getDefaultScores() };
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { scores: this.getDefaultScores() };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const scores: ConfidenceScore[] = [];

      for (const [field, data] of Object.entries(parsed)) {
        const d = data as { value: unknown; confidence: number; reasoning: string };
        scores.push({
          field,
          value: d.value,
          confidence: d.confidence,
          reasoning: d.reasoning,
          needsClarification: d.confidence < (CONFIDENCE_THRESHOLDS[field as keyof typeof CONFIDENCE_THRESHOLDS] || 50),
        });
      }

      return { scores };

    } catch (error) {
      console.error('Failed to extract intent:', error);
      return { scores: this.getDefaultScores() };
    }
  }

  /**
   * Generate clarification questions for low-confidence fields
   */
  private static generateClarificationQuestions(scores: ConfidenceScore[]): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];

    for (const score of scores) {
      if (!score.needsClarification) continue;

      const threshold = CONFIDENCE_THRESHOLDS[score.field as keyof typeof CONFIDENCE_THRESHOLDS] || 50;

      if (score.confidence < threshold) {
        const question = this.getQuestionForField(score.field, score.value);
        if (question) {
          questions.push(question);
        }
      }
    }

    // Sort by priority
    return questions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get the appropriate question for a field
   */
  private static getQuestionForField(
    field: string,
    currentValue: unknown
  ): ClarificationQuestion | null {
    const questions: Record<string, ClarificationQuestion> = {
      businessType: {
        id: 'businessType',
        field: 'businessType',
        question: 'What type of business or app is this?',
        options: [
          'E-commerce / Online store',
          'SaaS / Subscription service',
          'Marketplace / Platform',
          'Internal tool / Dashboard',
          'Content / Blog / Media',
          'Booking / Scheduling',
          'Social / Community',
          'Other',
        ],
        required: true,
        priority: 'high',
      },
      targetUsers: {
        id: 'targetUsers',
        field: 'targetUsers',
        question: 'Who will use this app?',
        options: [
          'Consumers (B2C)',
          'Businesses (B2B)',
          'Internal team only',
          'Developers / API users',
          'Multiple user types',
        ],
        required: true,
        priority: 'high',
      },
      coreFeature: {
        id: 'coreFeature',
        field: 'coreFeature',
        question: 'What is the #1 thing users need to do in this app?',
        required: true,
        priority: 'high',
      },
      hasPayments: {
        id: 'hasPayments',
        field: 'hasPayments',
        question: 'Will users pay for anything?',
        options: [
          'Yes - subscriptions',
          'Yes - one-time purchases',
          'Yes - marketplace (take a cut)',
          'No - free app',
          'Not sure yet',
        ],
        required: true,
        priority: 'high',
      },
      hasAuth: {
        id: 'hasAuth',
        field: 'hasAuth',
        question: 'Do users need accounts to use this?',
        options: [
          'Yes - required for all features',
          'Yes - for some features',
          'No - public access only',
        ],
        required: false,
        priority: 'medium',
      },
      hasRealtime: {
        id: 'hasRealtime',
        field: 'hasRealtime',
        question: 'Do you need real-time features?',
        options: [
          'Yes - live updates / notifications',
          'Yes - chat / messaging',
          'Yes - collaborative editing',
          'No - normal page loads are fine',
        ],
        required: false,
        priority: 'medium',
      },
      scale: {
        id: 'scale',
        field: 'scale',
        question: 'Expected number of users?',
        options: [
          'Small (< 1,000)',
          'Medium (1,000 - 100,000)',
          'Large (100,000+)',
          'Not sure yet',
        ],
        required: false,
        priority: 'low',
      },
    };

    return questions[field] || null;
  }

  /**
   * Get default scores when extraction fails
   */
  private static getDefaultScores(): ConfidenceScore[] {
    return [
      { field: 'businessType', value: null, confidence: 0, reasoning: 'Not specified', needsClarification: true },
      { field: 'targetUsers', value: null, confidence: 0, reasoning: 'Not specified', needsClarification: true },
      { field: 'coreFeature', value: null, confidence: 0, reasoning: 'Not specified', needsClarification: true },
      { field: 'hasPayments', value: null, confidence: 0, reasoning: 'Not specified', needsClarification: true },
      { field: 'hasAuth', value: true, confidence: 50, reasoning: 'Default assumption', needsClarification: true },
      { field: 'hasRealtime', value: false, confidence: 50, reasoning: 'Default assumption', needsClarification: false },
      { field: 'scale', value: 'small', confidence: 50, reasoning: 'Default assumption', needsClarification: false },
      { field: 'compliance', value: [], confidence: 50, reasoning: 'No compliance mentioned', needsClarification: false },
    ];
  }
}

// =============================================================================
// SCOPING SESSION CACHE
// =============================================================================

interface ScopingSession {
  sessionId: string;
  userInput: string;
  scores: ConfidenceScore[];
  questionsAsked: string[];
  confirmed: boolean;
}

const scopingCache = new Map<string, ScopingSession>();

export const ScopingCache = {
  create: (sessionId: string, userInput: string, scores: ConfidenceScore[]): ScopingSession => {
    const session: ScopingSession = {
      sessionId,
      userInput,
      scores,
      questionsAsked: [],
      confirmed: false,
    };
    scopingCache.set(sessionId, session);
    return session;
  },

  get: (sessionId: string): ScopingSession | null => scopingCache.get(sessionId) || null,

  updateScores: (sessionId: string, scores: ConfidenceScore[]): void => {
    const session = scopingCache.get(sessionId);
    if (session) {
      session.scores = scores;
    }
  },

  addQuestion: (sessionId: string, questionId: string): void => {
    const session = scopingCache.get(sessionId);
    if (session) {
      session.questionsAsked.push(questionId);
    }
  },

  confirm: (sessionId: string): void => {
    const session = scopingCache.get(sessionId);
    if (session) {
      session.confirmed = true;
    }
  },

  isConfirmed: (sessionId: string): boolean => {
    const session = scopingCache.get(sessionId);
    return session?.confirmed ?? false;
  },

  clear: (sessionId: string): void => {
    scopingCache.delete(sessionId);
  },
};
