/**
 * DECISION LOG SERVICE
 *
 * Logs all significant decisions with reasoning.
 * This ensures AI doesn't forget or contradict past decisions.
 *
 * Decisions are stored in .codebakers/DECISIONS.md and can be
 * loaded before any action to maintain consistency.
 */

import { createHash, randomUUID } from 'crypto';
import { Decision, DecisionCategory } from '@/lib/safety-types';

// =============================================================================
// DECISION LOG SERVICE
// =============================================================================

export class DecisionLogService {
  /**
   * Log a new decision
   */
  static createDecision(params: {
    decision: string;
    category: DecisionCategory;
    reasoning: string;
    alternativesConsidered?: string[];
    madeBy: 'user' | 'ai' | 'system';
    userApproved?: boolean;
    reversible?: boolean;
    impact: 'low' | 'medium' | 'high' | 'critical';
    relatedFiles?: string[];
  }): Decision {
    const decision: Decision = {
      id: randomUUID().slice(0, 8),
      timestamp: new Date().toISOString().split('T')[0],
      decision: params.decision,
      category: params.category,
      reasoning: params.reasoning,
      alternativesConsidered: params.alternativesConsidered || [],
      madeBy: params.madeBy,
      userApproved: params.userApproved ?? (params.madeBy === 'user'),
      reversible: params.reversible ?? true,
      impact: params.impact,
      relatedFiles: params.relatedFiles || [],
      relatedDecisions: [],
    };

    return decision;
  }

  /**
   * Format a decision for writing to DECISIONS.md
   */
  static formatDecisionForMarkdown(decision: Decision): string {
    const lines: string[] = [
      `## ${decision.timestamp} - ${decision.decision}`,
      '',
      `**Category:** ${decision.category}`,
      `**Impact:** ${decision.impact}`,
      `**Reversible:** ${decision.reversible ? 'Yes' : 'No'}`,
      `**Made by:** ${decision.madeBy}${decision.userApproved ? ' (user approved)' : ''}`,
      '',
      `**Reasoning:** ${decision.reasoning}`,
      '',
    ];

    if (decision.alternativesConsidered.length > 0) {
      lines.push('**Alternatives considered:**');
      decision.alternativesConsidered.forEach(alt => {
        lines.push(`- ${alt}`);
      });
      lines.push('');
    }

    if (decision.relatedFiles.length > 0) {
      lines.push('**Related files:**');
      decision.relatedFiles.forEach(file => {
        lines.push(`- \`${file}\``);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate the full DECISIONS.md content
   */
  static generateDecisionsFile(decisions: Decision[]): string {
    const header = `# Project Decisions

This file tracks all significant decisions made during development.
**AI must check this file before making changes that could contradict existing decisions.**

`;

    const sortedDecisions = [...decisions].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const decisionContent = sortedDecisions
      .map(d => this.formatDecisionForMarkdown(d))
      .join('\n');

    return header + decisionContent;
  }

  /**
   * Check if a proposed action contradicts an existing decision
   */
  static checkContradiction(
    proposedAction: string,
    existingDecisions: Decision[]
  ): {
    hasContradiction: boolean;
    conflictingDecision: Decision | null;
    explanation: string;
  } {
    const actionLower = proposedAction.toLowerCase();

    // Check for common contradiction patterns
    for (const decision of existingDecisions) {
      const decisionLower = decision.decision.toLowerCase();
      const reasoningLower = decision.reasoning.toLowerCase();

      // Pattern: Action says "local" but decision says "server-side"
      if (actionLower.includes('local') && decisionLower.includes('server-side')) {
        return {
          hasContradiction: true,
          conflictingDecision: decision,
          explanation: `Action involves local storage/processing, but decision "${decision.decision}" requires server-side approach.`,
        };
      }

      // Pattern: Action says "embed" but decision says "don't ship"
      if (
        (actionLower.includes('embed') || actionLower.includes('include') || actionLower.includes('ship')) &&
        (reasoningLower.includes("don't ship") || reasoningLower.includes('never ship') || reasoningLower.includes('stay server'))
      ) {
        return {
          hasContradiction: true,
          conflictingDecision: decision,
          explanation: `Action would embed/ship content, but decision "${decision.decision}" prohibits this.`,
        };
      }

      // Pattern: Action changes something marked as "do not change"
      if (
        decision.reversible === false &&
        this.actionAffectsDecision(actionLower, decisionLower)
      ) {
        return {
          hasContradiction: true,
          conflictingDecision: decision,
          explanation: `Action would modify something covered by irreversible decision "${decision.decision}".`,
        };
      }

      // Pattern: Action uses different technology than decided
      if (decision.category === 'tech-stack') {
        const techKeywords = this.extractTechKeywords(decisionLower);
        const actionTech = this.extractTechKeywords(actionLower);

        for (const [category, decidedTech] of Object.entries(techKeywords)) {
          const actionChoice = actionTech[category];
          if (actionChoice && decidedTech && actionChoice !== decidedTech) {
            return {
              hasContradiction: true,
              conflictingDecision: decision,
              explanation: `Action uses ${actionChoice} but decision specifies ${decidedTech} for ${category}.`,
            };
          }
        }
      }
    }

    return {
      hasContradiction: false,
      conflictingDecision: null,
      explanation: '',
    };
  }

  /**
   * Get decisions relevant to a specific area of work
   */
  static getRelevantDecisions(
    decisions: Decision[],
    area: string
  ): Decision[] {
    const areaLower = area.toLowerCase();

    return decisions.filter(d => {
      // Check if decision matches the work area
      const decisionLower = d.decision.toLowerCase();
      const reasoningLower = d.reasoning.toLowerCase();

      // Match by category
      if (areaLower.includes('auth') && d.category === 'security') return true;
      if (areaLower.includes('api') && d.category === 'api-design') return true;
      if (areaLower.includes('database') && d.category === 'data-model') return true;
      if (areaLower.includes('ui') && d.category === 'ui-design') return true;
      if (areaLower.includes('pattern') && d.category === 'patterns') return true;

      // Match by keywords in decision text
      const areaWords = areaLower.split(/\s+/);
      for (const word of areaWords) {
        if (word.length > 3 && (decisionLower.includes(word) || reasoningLower.includes(word))) {
          return true;
        }
      }

      // High/critical impact decisions are always relevant
      if (d.impact === 'critical' || d.impact === 'high') return true;

      return false;
    });
  }

  /**
   * Format decisions for AI prompt injection
   */
  static formatForPrompt(decisions: Decision[]): string {
    if (decisions.length === 0) {
      return '';
    }

    const lines: string[] = [
      '## ACTIVE DECISIONS (Must follow)',
      '',
    ];

    // Group by category
    const byCategory = new Map<DecisionCategory, Decision[]>();
    for (const d of decisions) {
      const existing = byCategory.get(d.category) || [];
      existing.push(d);
      byCategory.set(d.category, existing);
    }

    for (const [category, categoryDecisions] of byCategory) {
      lines.push(`### ${category}`);
      for (const d of categoryDecisions) {
        const icon = d.impact === 'critical' ? '🔴' :
                     d.impact === 'high' ? '🟠' :
                     d.impact === 'medium' ? '🟡' : '🟢';
        lines.push(`${icon} **${d.decision}**`);
        lines.push(`   Reasoning: ${d.reasoning}`);
        if (!d.reversible) {
          lines.push(`   ⚠️ IRREVERSIBLE - cannot be changed`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private static actionAffectsDecision(action: string, decision: string): boolean {
    // Extract key nouns from both
    const actionWords: string[] = action.match(/\b[a-z]{4,}\b/g) || [];
    const decisionWords: string[] = decision.match(/\b[a-z]{4,}\b/g) || [];

    // Check for overlap
    const overlap = actionWords.filter((w: string) => decisionWords.includes(w));
    return overlap.length >= 2; // At least 2 words in common
  }

  private static extractTechKeywords(text: string): Record<string, string> {
    const keywords: Record<string, string> = {};

    // Databases
    if (text.includes('supabase')) keywords.database = 'supabase';
    else if (text.includes('prisma')) keywords.database = 'prisma';
    else if (text.includes('drizzle')) keywords.orm = 'drizzle';
    else if (text.includes('postgres')) keywords.database = 'postgres';
    else if (text.includes('mysql')) keywords.database = 'mysql';
    else if (text.includes('mongodb')) keywords.database = 'mongodb';

    // Auth
    if (text.includes('supabase auth')) keywords.auth = 'supabase';
    else if (text.includes('next-auth') || text.includes('nextauth')) keywords.auth = 'next-auth';
    else if (text.includes('clerk')) keywords.auth = 'clerk';
    else if (text.includes('auth0')) keywords.auth = 'auth0';

    // UI
    if (text.includes('shadcn')) keywords.ui = 'shadcn';
    else if (text.includes('chakra')) keywords.ui = 'chakra';
    else if (text.includes('material')) keywords.ui = 'material-ui';
    else if (text.includes('tailwind')) keywords.css = 'tailwind';

    // Frameworks
    if (text.includes('next.js') || text.includes('nextjs')) keywords.framework = 'nextjs';
    else if (text.includes('react')) keywords.framework = 'react';
    else if (text.includes('vue')) keywords.framework = 'vue';

    return keywords;
  }
}

// =============================================================================
// COMMON DECISION TEMPLATES
// =============================================================================

export const DecisionTemplates = {
  patternsServerSide: (): Decision => DecisionLogService.createDecision({
    decision: 'Patterns stay server-side',
    category: 'architecture',
    reasoning: 'Patterns are loaded from server during code generation but never shipped to user\'s project. This protects IP and ensures users need subscription.',
    alternativesConsidered: [
      'Ship patterns locally (rejected - no recurring value)',
      'Hybrid local/server (rejected - complex, leaky)',
    ],
    madeBy: 'user',
    userApproved: true,
    reversible: false,
    impact: 'critical',
    relatedFiles: [
      'src/services/engineering-agent-service.ts',
      'src/services/content-service.ts',
    ],
  }),

  techStackDecision: (stack: {
    framework: string;
    database: string;
    orm: string;
    auth: string;
    ui: string;
  }): Decision => DecisionLogService.createDecision({
    decision: `Tech stack: ${stack.framework} + ${stack.database} + ${stack.auth}`,
    category: 'tech-stack',
    reasoning: `Using ${stack.framework} with ${stack.database} database, ${stack.orm} ORM, ${stack.auth} auth, and ${stack.ui} UI components.`,
    madeBy: 'ai',
    userApproved: true,
    reversible: false,
    impact: 'critical',
  }),

  noHardcodedVersions: (): Decision => DecisionLogService.createDecision({
    decision: 'No hardcoded version numbers',
    category: 'patterns',
    reasoning: 'Version numbers should be read from state/config, never hardcoded. Prevents version drift.',
    madeBy: 'ai',
    userApproved: true,
    reversible: true,
    impact: 'medium',
  }),

  mcpEnforcement: (): Decision => DecisionLogService.createDecision({
    decision: 'Patterns enforced via MCP tools',
    category: 'architecture',
    reasoning: 'Users must call discover_patterns and validate_complete MCP tools. This ensures server-side pattern enforcement.',
    madeBy: 'user',
    userApproved: true,
    reversible: false,
    impact: 'critical',
    relatedFiles: [
      'src/mcp/tools/',
    ],
  }),
};

// =============================================================================
// DECISION CACHE (for active sessions)
// =============================================================================

const decisionCache = new Map<string, Decision[]>();

export const DecisionCache = {
  get: (sessionId: string): Decision[] => decisionCache.get(sessionId) || [],

  add: (sessionId: string, decision: Decision): void => {
    const existing = decisionCache.get(sessionId) || [];
    existing.push(decision);
    decisionCache.set(sessionId, existing);
  },

  set: (sessionId: string, decisions: Decision[]): void => {
    decisionCache.set(sessionId, decisions);
  },

  clear: (sessionId: string): void => {
    decisionCache.delete(sessionId);
  },
};
