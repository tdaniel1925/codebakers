/**
 * CONTEXT LOADER SERVICE
 *
 * Loads all project context before any AI action.
 * This prevents the AI from forgetting previous decisions,
 * ignoring established patterns, or contradicting past work.
 *
 * MANDATORY: Must be called before discover_patterns or any code generation.
 */

import { createHash } from 'crypto';
import {
  ProjectContext,
  Decision,
  Attempt,
  Blocker,
  FileChange,
  DevlogEntry,
} from '@/lib/safety-types';

// =============================================================================
// CONTEXT LOADER
// =============================================================================

export class ContextLoaderService {
  /**
   * Load complete project context from .codebakers files
   * This is the first gate - AI cannot proceed without this
   */
  static async loadContext(projectPath: string): Promise<{
    success: boolean;
    context: ProjectContext | null;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Load .codebakers.json (main state file)
      const stateFile = await this.readFile(`${projectPath}/.codebakers.json`);
      const state = stateFile ? JSON.parse(stateFile) : null;

      if (!state) {
        errors.push('No .codebakers.json found - is this a CodeBakers project?');
        return { success: false, context: null, errors, warnings };
      }

      // Load decisions
      const decisionsFile = await this.readFile(`${projectPath}/.codebakers/DECISIONS.md`);
      const decisions = decisionsFile ? this.parseDecisions(decisionsFile) : [];

      // Load devlog (recent activity)
      const devlogFile = await this.readFile(`${projectPath}/.codebakers/DEVLOG.md`);
      const devlogEntries = devlogFile ? this.parseDevlog(devlogFile) : [];

      // Load attempts (what's been tried)
      const attemptsFile = await this.readFile(`${projectPath}/.codebakers/ATTEMPTS.md`);
      const attempts = attemptsFile ? this.parseAttempts(attemptsFile) : [];

      // Load blockers
      const blockersFile = await this.readFile(`${projectPath}/.codebakers/BLOCKED.md`);
      const blockers = blockersFile ? this.parseBlockers(blockersFile) : [];

      // Get recent file changes from devlog
      const recentChanges: FileChange[] = devlogEntries
        .slice(0, 5)
        .flatMap(entry =>
          entry.filesChanged.map(fc => ({
            path: fc.path,
            type: 'modified' as const,
            timestamp: entry.date,
            summary: fc.change,
          }))
        );

      // Build context
      const context: ProjectContext = {
        version: state.version || '1.0',
        projectName: state.projectName || 'Unknown',
        projectType: state.projectType || 'existing',
        currentPhase: state.build?.currentPhase || 'development',
        lastUpdated: state.lastUpdated || new Date().toISOString(),

        stack: state.stack || {
          framework: 'nextjs',
          database: 'supabase',
          orm: 'drizzle',
          auth: 'supabase',
          ui: 'shadcn',
        },

        builtFeatures: state.builtFeatures || [],
        pendingFeatures: state.pendingFeatures || [],

        recentCommits: [], // Would load from git
        recentChanges,

        decisions,
        recentAttempts: attempts.slice(0, 10),
        blockers: blockers.filter(b => b.status === 'active'),
      };

      // Add warnings for important context
      if (decisions.length > 0) {
        const criticalDecisions = decisions.filter(d => d.impact === 'critical');
        if (criticalDecisions.length > 0) {
          warnings.push(`${criticalDecisions.length} critical decisions in effect - review before making changes`);
        }
      }

      if (blockers.length > 0) {
        warnings.push(`${blockers.length} active blockers - check BLOCKED.md`);
      }

      const failedAttempts = attempts.filter(a => a.result === 'failure' && a.shouldNotRetry);
      if (failedAttempts.length > 0) {
        warnings.push(`${failedAttempts.length} approaches marked as "do not retry"`);
      }

      return { success: true, context, errors, warnings };

    } catch (error) {
      errors.push(`Failed to load context: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, context: null, errors, warnings };
    }
  }

  /**
   * Get a summary of context for AI prompt injection
   */
  static formatContextForPrompt(context: ProjectContext): string {
    const lines: string[] = [
      '## PROJECT CONTEXT (Loaded from .codebakers)',
      '',
      `**Project:** ${context.projectName} (${context.projectType})`,
      `**Version:** ${context.version}`,
      `**Phase:** ${context.currentPhase}`,
      '',
      '### Tech Stack',
      `- Framework: ${context.stack.framework}`,
      `- Database: ${context.stack.database}`,
      `- ORM: ${context.stack.orm}`,
      `- Auth: ${context.stack.auth}`,
      `- UI: ${context.stack.ui}`,
      context.stack.payments ? `- Payments: ${context.stack.payments}` : '',
      '',
    ];

    // Add critical decisions
    const criticalDecisions = context.decisions.filter(d =>
      d.impact === 'critical' || d.impact === 'high'
    );
    if (criticalDecisions.length > 0) {
      lines.push('### CRITICAL DECISIONS (Must follow)');
      criticalDecisions.forEach(d => {
        lines.push(`- **${d.decision}**: ${d.reasoning}`);
      });
      lines.push('');
    }

    // Add recent attempts to avoid repeating
    const failedAttempts = context.recentAttempts.filter(a => a.result === 'failure');
    if (failedAttempts.length > 0) {
      lines.push('### FAILED APPROACHES (Do not retry)');
      failedAttempts.slice(0, 5).forEach(a => {
        lines.push(`- ${a.approach}: ${a.errorMessage || 'Failed'}`);
      });
      lines.push('');
    }

    // Add blockers
    if (context.blockers.length > 0) {
      lines.push('### ACTIVE BLOCKERS');
      context.blockers.forEach(b => {
        lines.push(`- ${b.description}`);
      });
      lines.push('');
    }

    // Add built features
    if (context.builtFeatures.length > 0) {
      lines.push('### Built Features');
      context.builtFeatures.forEach(f => {
        lines.push(`- ${f}`);
      });
      lines.push('');
    }

    return lines.filter(l => l !== '').join('\n');
  }

  /**
   * Load context from provided content strings (for API usage)
   * Use this when content is passed from client rather than read from files
   */
  static loadContextFromContent(params: {
    stateJson?: string;
    decisionsContent?: string;
    devlogContent?: string;
    attemptsContent?: string;
    blockedContent?: string;
  }): ProjectContext {
    const state = params.stateJson ? JSON.parse(params.stateJson) : {};

    const decisions = params.decisionsContent ? this.parseDecisions(params.decisionsContent) : [];
    const devlogEntries = params.devlogContent ? this.parseDevlog(params.devlogContent) : [];
    const attempts = params.attemptsContent ? this.parseAttempts(params.attemptsContent) : [];
    const blockers = params.blockedContent ? this.parseBlockers(params.blockedContent) : [];

    const recentChanges: FileChange[] = devlogEntries
      .slice(0, 5)
      .flatMap(entry =>
        entry.filesChanged.map(fc => ({
          path: fc.path,
          type: 'modified' as const,
          timestamp: entry.date,
          summary: fc.change,
        }))
      );

    return {
      version: state.version || '1.0',
      projectName: state.projectName || 'Unknown',
      projectType: state.projectType || 'existing',
      currentPhase: state.build?.currentPhase || 'development',
      lastUpdated: state.lastUpdated || new Date().toISOString(),

      stack: state.stack || {
        framework: 'nextjs',
        database: 'supabase',
        orm: 'drizzle',
        auth: 'supabase',
        ui: 'shadcn',
      },

      builtFeatures: state.builtFeatures || [],
      pendingFeatures: state.pendingFeatures || [],

      recentCommits: [],
      recentChanges,

      decisions,
      recentAttempts: attempts.slice(0, 10),
      blockers: blockers.filter(b => b.status === 'active'),
    };
  }

  /**
   * Check if context has been loaded for a session
   */
  static isContextLoaded(sessionId: string): boolean {
    return contextCache.has(sessionId);
  }

  /**
   * Get cached context for a session
   */
  static getCachedContext(sessionId: string): ProjectContext | null {
    return contextCache.get(sessionId) || null;
  }

  /**
   * Cache context for a session
   */
  static cacheContext(sessionId: string, context: ProjectContext): void {
    contextCache.set(sessionId, context);
  }

  /**
   * Clear cached context
   */
  static clearCache(sessionId: string): void {
    contextCache.delete(sessionId);
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private static async readFile(path: string): Promise<string | null> {
    try {
      // This would use fs in Node.js or an API call in browser
      // For MCP tools, we'll pass file contents from the client
      return null;
    } catch {
      return null;
    }
  }

  private static parseDecisions(content: string): Decision[] {
    const decisions: Decision[] = [];
    const sections = content.split(/^## /gm).filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      const titleLine = lines[0] || '';
      const match = titleLine.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(.+)$/);

      if (match) {
        const [, date, title] = match;
        const bodyLines = lines.slice(1).join('\n');

        const decision: Decision = {
          id: createHash('md5').update(`${date}-${title}`).digest('hex').slice(0, 8),
          timestamp: date,
          decision: title,
          category: this.inferDecisionCategory(title, bodyLines),
          reasoning: this.extractField(bodyLines, 'Reasoning') || '',
          alternativesConsidered: this.extractList(bodyLines, 'Alternatives considered'),
          madeBy: this.extractField(bodyLines, 'Made by') as 'user' | 'ai' | 'system' || 'ai',
          userApproved: bodyLines.includes('user approved') || bodyLines.includes('User approved'),
          reversible: !bodyLines.toLowerCase().includes('reversible: no'),
          impact: this.extractImpact(bodyLines),
          relatedFiles: this.extractList(bodyLines, 'Related files'),
          relatedDecisions: [],
        };

        decisions.push(decision);
      }
    }

    return decisions;
  }

  private static parseDevlog(content: string): DevlogEntry[] {
    const entries: DevlogEntry[] = [];
    const sections = content.split(/^## /gm).filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      const titleLine = lines[0] || '';
      const match = titleLine.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*-\s*(.+)$/);

      if (match) {
        const [, date, title] = match;
        const bodyLines = lines.slice(1).join('\n');

        const entry: DevlogEntry = {
          date,
          title,
          sessionId: this.extractField(bodyLines, 'Session') || '',
          taskSize: this.extractField(bodyLines, 'Task Size') as DevlogEntry['taskSize'] || 'medium',
          status: this.extractField(bodyLines, 'Status') as DevlogEntry['status'] || 'completed',
          whatWasDone: this.extractList(bodyLines, 'What was done'),
          filesChanged: this.extractFileChanges(bodyLines),
          decisionsMode: this.extractList(bodyLines, 'Decisions made'),
          nextSteps: this.extractList(bodyLines, 'Next steps'),
        };

        entries.push(entry);
      }
    }

    return entries;
  }

  private static parseAttempts(content: string): Attempt[] {
    const attempts: Attempt[] = [];
    const sections = content.split(/^## Issue:/gm).filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      const issue = lines[0]?.trim() || '';
      const issueHash = createHash('md5').update(issue).digest('hex').slice(0, 8);

      // Parse individual attempts within this issue
      const attemptSections = section.split(/^### Attempt \d+/gm).filter(Boolean);

      for (let i = 0; i < attemptSections.length; i++) {
        const attemptSection = attemptSections[i];
        const result = attemptSection.includes('(Success)') ? 'success' :
                       attemptSection.includes('(Failed)') ? 'failure' : 'partial';

        const codeMatch = attemptSection.match(/```[\s\S]*?```/);
        const errorMatch = attemptSection.match(/Error:\s*(.+)/);

        const attempt: Attempt = {
          id: `${issueHash}-${i}`,
          timestamp: new Date().toISOString(),
          issue,
          issueHash,
          approach: this.extractField(attemptSection, 'Approach') || `Attempt ${i + 1}`,
          codeOrCommand: codeMatch ? codeMatch[0].replace(/```/g, '').trim() : '',
          result,
          errorMessage: errorMatch ? errorMatch[1] : undefined,
          lessonsLearned: this.extractField(attemptSection, 'Lesson'),
          shouldNotRetry: result === 'failure' && attemptSection.includes('do not retry'),
        };

        attempts.push(attempt);
      }
    }

    return attempts;
  }

  private static parseBlockers(content: string): Blocker[] {
    const blockers: Blocker[] = [];
    const sections = content.split(/^## /gm).filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      const titleLine = lines[0] || '';
      const match = titleLine.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*-\s*(.+)$/);

      if (match) {
        const [, date, title] = match;
        const bodyLines = lines.slice(1).join('\n');

        const blocker: Blocker = {
          id: createHash('md5').update(`${date}-${title}`).digest('hex').slice(0, 8),
          createdAt: date,
          description: title,
          category: this.inferBlockerCategory(bodyLines),
          errorMessage: this.extractField(bodyLines, 'Error'),
          attemptsMade: this.extractList(bodyLines, 'Attempted Solutions'),
          status: bodyLines.toLowerCase().includes('status: resolved') ? 'resolved' : 'active',
          resolvedAt: this.extractField(bodyLines, 'Resolved at'),
          resolution: this.extractField(bodyLines, 'Resolution'),
        };

        blockers.push(blocker);
      }
    }

    return blockers;
  }

  private static extractField(content: string, fieldName: string): string | undefined {
    const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private static extractList(content: string, sectionName: string): string[] {
    const regex = new RegExp(`\\*\\*${sectionName}:\\*\\*[\\s\\S]*?(?=\\*\\*|$)`, 'i');
    const match = content.match(regex);
    if (!match) return [];

    const items = match[0].match(/^-\s+(.+)$/gm);
    return items ? items.map(item => item.replace(/^-\s+/, '').trim()) : [];
  }

  private static extractFileChanges(content: string): { path: string; change: string }[] {
    const changes: { path: string; change: string }[] = [];
    const regex = /^-\s+`([^`]+)`\s*-\s*(.+)$/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
      changes.push({ path: match[1], change: match[2] });
    }

    return changes;
  }

  private static inferDecisionCategory(title: string, body: string): Decision['category'] {
    const text = `${title} ${body}`.toLowerCase();

    if (text.includes('architect') || text.includes('structure') || text.includes('design')) {
      return 'architecture';
    }
    if (text.includes('stack') || text.includes('framework') || text.includes('library')) {
      return 'tech-stack';
    }
    if (text.includes('pattern') || text.includes('convention')) {
      return 'patterns';
    }
    if (text.includes('security') || text.includes('auth') || text.includes('encrypt')) {
      return 'security';
    }
    if (text.includes('schema') || text.includes('database') || text.includes('table')) {
      return 'data-model';
    }
    if (text.includes('api') || text.includes('endpoint') || text.includes('route')) {
      return 'api-design';
    }
    if (text.includes('ui') || text.includes('component') || text.includes('design')) {
      return 'ui-design';
    }
    if (text.includes('integration') || text.includes('third-party') || text.includes('external')) {
      return 'integration';
    }
    if (text.includes('deploy') || text.includes('infra') || text.includes('hosting')) {
      return 'deployment';
    }

    return 'business-logic';
  }

  private static extractImpact(content: string): Decision['impact'] {
    const lower = content.toLowerCase();
    if (lower.includes('impact: critical')) return 'critical';
    if (lower.includes('impact: high')) return 'high';
    if (lower.includes('impact: medium')) return 'medium';
    return 'low';
  }

  private static inferBlockerCategory(content: string): Blocker['category'] {
    const lower = content.toLowerCase();
    if (lower.includes('error') || lower.includes('exception') || lower.includes('failed')) {
      return 'error';
    }
    if (lower.includes('missing') || lower.includes('need') || lower.includes('require')) {
      return 'missing-info';
    }
    if (lower.includes('waiting') || lower.includes('external') || lower.includes('api key')) {
      return 'waiting-external';
    }
    return 'needs-decision';
  }
}

// In-memory cache for loaded contexts
const contextCache = new Map<string, ProjectContext>();

// =============================================================================
// CONTEXT CACHE (exported for use by API routes)
// =============================================================================

export const ContextCache = {
  get: (sessionId: string): ProjectContext | null => contextCache.get(sessionId) || null,

  set: (sessionId: string, context: ProjectContext): void => {
    contextCache.set(sessionId, context);
  },

  has: (sessionId: string): boolean => contextCache.has(sessionId),

  clear: (sessionId: string): void => {
    contextCache.delete(sessionId);
  },
};
