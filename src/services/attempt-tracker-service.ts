/**
 * ATTEMPT TRACKER SERVICE
 *
 * Tracks what has been tried for each issue/problem.
 * Prevents AI from suggesting the same failed approach multiple times.
 *
 * Stored in .codebakers/ATTEMPTS.md for persistence across sessions.
 */

import { createHash, randomUUID } from 'crypto';
import { Attempt } from '@/lib/safety-types';

// =============================================================================
// ATTEMPT TRACKER SERVICE
// =============================================================================

export class AttemptTrackerService {
  /**
   * Create a new attempt record
   */
  static createAttempt(params: {
    issue: string;
    approach: string;
    codeOrCommand: string;
    result: 'success' | 'failure' | 'partial';
    errorMessage?: string;
    lessonsLearned?: string;
  }): Attempt {
    const issueHash = createHash('md5').update(params.issue.toLowerCase().trim()).digest('hex').slice(0, 8);

    return {
      id: randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      issue: params.issue,
      issueHash,
      approach: params.approach,
      codeOrCommand: params.codeOrCommand,
      result: params.result,
      errorMessage: params.errorMessage,
      lessonsLearned: params.lessonsLearned,
      shouldNotRetry: params.result === 'failure' && !params.lessonsLearned?.includes('might work'),
    };
  }

  /**
   * Check if an approach has already been tried for an issue
   */
  static hasBeenTried(
    issue: string,
    proposedApproach: string,
    existingAttempts: Attempt[]
  ): {
    alreadyTried: boolean;
    previousAttempt: Attempt | null;
    recommendation: string;
  } {
    const issueHash = createHash('md5').update(issue.toLowerCase().trim()).digest('hex').slice(0, 8);
    const approachLower = proposedApproach.toLowerCase();

    // Find attempts for this issue
    const issueAttempts = existingAttempts.filter(a => a.issueHash === issueHash);

    for (const attempt of issueAttempts) {
      const similarity = this.calculateSimilarity(approachLower, attempt.approach.toLowerCase());

      if (similarity > 0.7) {
        // Very similar approach
        if (attempt.result === 'failure' && attempt.shouldNotRetry) {
          return {
            alreadyTried: true,
            previousAttempt: attempt,
            recommendation: `This approach was tried and failed: "${attempt.approach}". Error: ${attempt.errorMessage}. Try a different approach.`,
          };
        } else if (attempt.result === 'success') {
          return {
            alreadyTried: true,
            previousAttempt: attempt,
            recommendation: `This approach worked before: "${attempt.approach}". Reuse the same solution.`,
          };
        }
      }
    }

    // Check for lessons learned that might help
    const relevantLessons = issueAttempts
      .filter(a => a.lessonsLearned)
      .map(a => a.lessonsLearned);

    if (relevantLessons.length > 0) {
      return {
        alreadyTried: false,
        previousAttempt: null,
        recommendation: `Previous attempts provided insights: ${relevantLessons.join('; ')}`,
      };
    }

    return {
      alreadyTried: false,
      previousAttempt: null,
      recommendation: '',
    };
  }

  /**
   * Get all failed attempts for an issue
   */
  static getFailedAttempts(issue: string, existingAttempts: Attempt[]): Attempt[] {
    const issueHash = createHash('md5').update(issue.toLowerCase().trim()).digest('hex').slice(0, 8);
    return existingAttempts.filter(a => a.issueHash === issueHash && a.result === 'failure');
  }

  /**
   * Get successful approaches that might be reusable
   */
  static getSuccessfulApproaches(
    category: string,
    existingAttempts: Attempt[]
  ): Attempt[] {
    const categoryLower = category.toLowerCase();
    return existingAttempts.filter(a =>
      a.result === 'success' &&
      (a.issue.toLowerCase().includes(categoryLower) ||
       a.approach.toLowerCase().includes(categoryLower))
    );
  }

  /**
   * Format attempts for ATTEMPTS.md
   */
  static formatAttemptsForMarkdown(attempts: Attempt[]): string {
    const header = `# Attempt History

This file tracks what has been tried for each issue.
**AI must check this file before suggesting fixes to avoid repeating failed approaches.**

`;

    // Group by issue
    const byIssue = new Map<string, Attempt[]>();
    for (const attempt of attempts) {
      const existing = byIssue.get(attempt.issueHash) || [];
      existing.push(attempt);
      byIssue.set(attempt.issueHash, existing);
    }

    const sections: string[] = [];

    for (const [issueHash, issueAttempts] of byIssue) {
      const issue = issueAttempts[0].issue;
      const lines: string[] = [
        `## Issue: ${issue}`,
        '',
      ];

      // Sort by timestamp
      const sorted = [...issueAttempts].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      sorted.forEach((attempt, index) => {
        const resultEmoji = attempt.result === 'success' ? '✅' :
                           attempt.result === 'failure' ? '❌' : '⚠️';
        const retryWarning = attempt.shouldNotRetry ? ' ⛔ DO NOT RETRY' : '';

        lines.push(`### Attempt ${index + 1} (${attempt.result})${retryWarning}`);
        lines.push('');
        lines.push(`**Approach:** ${attempt.approach}`);
        lines.push('');

        if (attempt.codeOrCommand) {
          lines.push('```');
          lines.push(attempt.codeOrCommand);
          lines.push('```');
          lines.push('');
        }

        if (attempt.errorMessage) {
          lines.push(`**Error:** ${attempt.errorMessage}`);
          lines.push('');
        }

        if (attempt.lessonsLearned) {
          lines.push(`**Lesson:** ${attempt.lessonsLearned}`);
          lines.push('');
        }
      });

      lines.push('---');
      lines.push('');
      sections.push(lines.join('\n'));
    }

    return header + sections.join('\n');
  }

  /**
   * Format failed attempts for AI prompt to prevent repetition
   */
  static formatForPrompt(issue: string, attempts: Attempt[]): string {
    const failed = this.getFailedAttempts(issue, attempts);

    if (failed.length === 0) {
      return '';
    }

    const lines: string[] = [
      '## FAILED APPROACHES (Do not retry these)',
      '',
    ];

    for (const attempt of failed) {
      lines.push(`❌ **${attempt.approach}**`);
      if (attempt.errorMessage) {
        lines.push(`   Error: ${attempt.errorMessage}`);
      }
      if (attempt.lessonsLearned) {
        lines.push(`   Lesson: ${attempt.lessonsLearned}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Suggest alternative approaches based on what's been tried
   */
  static suggestAlternatives(
    issue: string,
    existingAttempts: Attempt[]
  ): string[] {
    const failed = this.getFailedAttempts(issue, existingAttempts);
    const suggestions: string[] = [];

    // Analyze failed attempts for patterns
    const usedBash = failed.some(a => a.codeOrCommand.includes('bash') || a.codeOrCommand.includes('sh '));
    const usedPowerShell = failed.some(a => a.codeOrCommand.includes('powershell'));
    const usedNode = failed.some(a => a.codeOrCommand.includes('node ') || a.codeOrCommand.includes('npx '));

    // Suggest alternatives based on what hasn't been tried
    if (usedBash && !usedPowerShell) {
      suggestions.push('Try using PowerShell instead of bash (better Windows compatibility)');
    }
    if (!usedNode) {
      suggestions.push('Try using a Node.js script instead of shell commands');
    }

    // Look at error messages for clues
    for (const attempt of failed) {
      if (attempt.errorMessage?.includes('not found')) {
        suggestions.push('Check if the command/module is installed');
      }
      if (attempt.errorMessage?.includes('permission')) {
        suggestions.push('Try running with elevated permissions or check file permissions');
      }
      if (attempt.errorMessage?.includes('path') || attempt.errorMessage?.includes('space')) {
        suggestions.push('Try quoting paths or using a different path format');
      }
      if (attempt.errorMessage?.includes('timeout')) {
        suggestions.push('Try increasing timeout or breaking into smaller operations');
      }
    }

    // Deduplicate
    return [...new Set(suggestions)];
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Calculate similarity between two strings (simple Jaccard similarity)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }
}

// =============================================================================
// IN-MEMORY CACHE FOR ACTIVE SESSIONS
// =============================================================================

const attemptCache = new Map<string, Attempt[]>();

export const AttemptCache = {
  get: (sessionId: string): Attempt[] => attemptCache.get(sessionId) || [],

  add: (sessionId: string, attempt: Attempt): void => {
    const existing = attemptCache.get(sessionId) || [];
    existing.push(attempt);
    attemptCache.set(sessionId, existing);
  },

  clear: (sessionId: string): void => {
    attemptCache.delete(sessionId);
  },
};
