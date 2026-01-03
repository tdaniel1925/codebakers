/**
 * SCOPE LOCK SERVICE
 *
 * Prevents AI from doing more than requested (scope creep).
 * Defines boundaries for what can be changed and blocks violations.
 *
 * Also includes contradiction detection to ensure new actions
 * don't conflict with established decisions.
 */

import { randomUUID } from 'crypto';
import {
  ScopeLock,
  ScopeAction,
  ScopeViolation,
  Contradiction,
  Decision,
} from '@/lib/safety-types';
import { DecisionLogService } from './decision-log-service';

// =============================================================================
// SCOPE LOCK SERVICE
// =============================================================================

export class ScopeLockService {
  /**
   * Create a scope lock for a specific task
   */
  static createScopeLock(params: {
    userRequest: string;
    inferredScope: {
      allowedFiles?: string[];
      allowedDirectories?: string[];
      forbiddenFiles?: string[];
    };
  }): ScopeLock {
    const { userRequest, inferredScope } = params;

    // Infer allowed actions from request
    const allowedActions = this.inferAllowedActions(userRequest);

    // Infer scope boundaries
    const boundaries = this.inferBoundaries(userRequest, inferredScope);

    return {
      id: randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      userRequest,
      allowedFiles: inferredScope.allowedFiles || [],
      allowedDirectories: boundaries.directories,
      allowedActions,
      forbiddenFiles: [
        ...inferredScope.forbiddenFiles || [],
        // Always protect certain files
        '.env',
        '.env.local',
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
      ],
      forbiddenPatterns: [
        // Don't modify other people's code patterns
        'node_modules/',
        '.git/',
        '.next/',
        'dist/',
      ],
      maxNewFiles: boundaries.maxNewFiles,
      maxModifiedFiles: boundaries.maxModifiedFiles,
      canDeleteFiles: boundaries.canDelete,
      canModifyPackageJson: boundaries.canModifyDeps,
      canModifySchema: boundaries.canModifySchema,
      isActive: true,
      violations: [],
    };
  }

  /**
   * Check if an action is allowed within the scope
   */
  static checkAction(
    scopeLock: ScopeLock,
    action: {
      type: ScopeAction;
      targetFile: string;
      details?: string;
    }
  ): {
    allowed: boolean;
    reason: string;
    violation?: ScopeViolation;
  } {
    const { type, targetFile } = action;

    // Check forbidden patterns
    for (const pattern of scopeLock.forbiddenPatterns) {
      if (targetFile.includes(pattern)) {
        const violation: ScopeViolation = {
          timestamp: new Date().toISOString(),
          attemptedAction: type,
          targetFile,
          reason: `File matches forbidden pattern: ${pattern}`,
          blocked: true,
        };
        return {
          allowed: false,
          reason: violation.reason,
          violation,
        };
      }
    }

    // Check forbidden files
    for (const forbidden of scopeLock.forbiddenFiles) {
      if (targetFile.endsWith(forbidden) || targetFile === forbidden) {
        const violation: ScopeViolation = {
          timestamp: new Date().toISOString(),
          attemptedAction: type,
          targetFile,
          reason: `File is explicitly forbidden: ${forbidden}`,
          blocked: true,
        };
        return {
          allowed: false,
          reason: violation.reason,
          violation,
        };
      }
    }

    // Check action-specific rules
    if (type === 'delete-file' && !scopeLock.canDeleteFiles) {
      const violation: ScopeViolation = {
        timestamp: new Date().toISOString(),
        attemptedAction: type,
        targetFile,
        reason: 'File deletion not allowed for this task',
        blocked: true,
      };
      return {
        allowed: false,
        reason: violation.reason,
        violation,
      };
    }

    if (type === 'add-dependency' || type === 'remove-dependency') {
      if (!scopeLock.canModifyPackageJson) {
        const violation: ScopeViolation = {
          timestamp: new Date().toISOString(),
          attemptedAction: type,
          targetFile: 'package.json',
          reason: 'Dependency changes not allowed for this task',
          blocked: true,
        };
        return {
          allowed: false,
          reason: violation.reason,
          violation,
        };
      }
    }

    if (targetFile.includes('schema') && !scopeLock.canModifySchema) {
      const violation: ScopeViolation = {
        timestamp: new Date().toISOString(),
        attemptedAction: type,
        targetFile,
        reason: 'Schema modifications not allowed for this task',
        blocked: true,
      };
      return {
        allowed: false,
        reason: violation.reason,
        violation,
      };
    }

    // Check if action type is allowed
    if (!scopeLock.allowedActions.includes(type)) {
      const violation: ScopeViolation = {
        timestamp: new Date().toISOString(),
        attemptedAction: type,
        targetFile,
        reason: `Action type "${type}" not in allowed actions`,
        blocked: true,
      };
      return {
        allowed: false,
        reason: violation.reason,
        violation,
      };
    }

    // Check if file is in allowed directories
    const inAllowedDir = scopeLock.allowedDirectories.length === 0 ||
      scopeLock.allowedDirectories.some(dir => targetFile.startsWith(dir));

    if (!inAllowedDir && scopeLock.allowedDirectories.length > 0) {
      const violation: ScopeViolation = {
        timestamp: new Date().toISOString(),
        attemptedAction: type,
        targetFile,
        reason: `File not in allowed directories: ${scopeLock.allowedDirectories.join(', ')}`,
        blocked: true,
      };
      return {
        allowed: false,
        reason: violation.reason,
        violation,
      };
    }

    return { allowed: true, reason: 'Action permitted within scope' };
  }

  /**
   * Check for contradictions with existing decisions
   */
  static checkContradiction(
    proposedAction: string,
    existingDecisions: Decision[]
  ): Contradiction | null {
    const result = DecisionLogService.checkContradiction(proposedAction, existingDecisions);

    if (result.hasContradiction && result.conflictingDecision) {
      return {
        proposedAction,
        conflictingDecision: result.conflictingDecision,
        severity: result.conflictingDecision.impact === 'critical' ? 'critical' :
                  result.conflictingDecision.impact === 'high' ? 'error' : 'warning',
        explanation: result.explanation,
        resolution: { type: 'cancel', reason: result.explanation },
      };
    }

    return null;
  }

  /**
   * Format scope lock for display
   */
  static formatForDisplay(scopeLock: ScopeLock): string {
    const lines: string[] = [
      '## SCOPE LOCK ACTIVE',
      '',
      `**Task:** ${scopeLock.userRequest}`,
      '',
      '### Allowed',
      `- Actions: ${scopeLock.allowedActions.join(', ')}`,
      `- Directories: ${scopeLock.allowedDirectories.length > 0 ? scopeLock.allowedDirectories.join(', ') : 'Any'}`,
      `- Max new files: ${scopeLock.maxNewFiles}`,
      `- Max modified files: ${scopeLock.maxModifiedFiles}`,
      '',
      '### Forbidden',
      `- Files: ${scopeLock.forbiddenFiles.join(', ')}`,
      `- Delete files: ${scopeLock.canDeleteFiles ? 'Yes' : 'No'}`,
      `- Modify package.json: ${scopeLock.canModifyPackageJson ? 'Yes' : 'No'}`,
      `- Modify schema: ${scopeLock.canModifySchema ? 'Yes' : 'No'}`,
    ];

    if (scopeLock.violations.length > 0) {
      lines.push('');
      lines.push('### Violations');
      scopeLock.violations.forEach(v => {
        lines.push(`- ❌ ${v.attemptedAction} on ${v.targetFile}: ${v.reason}`);
      });
    }

    return lines.join('\n');
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private static inferAllowedActions(request: string): ScopeAction[] {
    const lower = request.toLowerCase();
    const actions: ScopeAction[] = [];

    // Default: create and modify files
    actions.push('create-file', 'modify-file');

    // Check for dependency changes
    if (
      lower.includes('install') ||
      lower.includes('add package') ||
      lower.includes('add dependency') ||
      lower.includes('npm') ||
      lower.includes('package')
    ) {
      actions.push('add-dependency');
    }

    // Check for deletions
    if (
      lower.includes('delete') ||
      lower.includes('remove') ||
      lower.includes('clean up')
    ) {
      actions.push('delete-file');
    }

    // Check for commands
    if (
      lower.includes('run') ||
      lower.includes('execute') ||
      lower.includes('build') ||
      lower.includes('test')
    ) {
      actions.push('run-command');
    }

    // Check for config changes
    if (
      lower.includes('config') ||
      lower.includes('setting') ||
      lower.includes('environment')
    ) {
      actions.push('modify-config');
    }

    return actions;
  }

  private static inferBoundaries(
    request: string,
    providedScope: { allowedFiles?: string[]; allowedDirectories?: string[] }
  ): {
    directories: string[];
    maxNewFiles: number;
    maxModifiedFiles: number;
    canDelete: boolean;
    canModifyDeps: boolean;
    canModifySchema: boolean;
  } {
    const lower = request.toLowerCase();

    // Infer directories from request
    const directories = providedScope.allowedDirectories || [];

    if (lower.includes('component')) directories.push('src/components/');
    if (lower.includes('page')) directories.push('src/app/');
    if (lower.includes('api') || lower.includes('route')) directories.push('src/app/api/');
    if (lower.includes('database') || lower.includes('schema')) directories.push('src/db/');
    if (lower.includes('lib') || lower.includes('util')) directories.push('src/lib/');
    if (lower.includes('test')) directories.push('tests/', '__tests__/');

    // Estimate scope size
    const isSmall = lower.includes('fix') || lower.includes('typo') || lower.includes('small');
    const isLarge = lower.includes('feature') || lower.includes('system') || lower.includes('refactor');

    return {
      directories: [...new Set(directories)],
      maxNewFiles: isSmall ? 2 : isLarge ? 20 : 10,
      maxModifiedFiles: isSmall ? 3 : isLarge ? 30 : 15,
      canDelete: lower.includes('delete') || lower.includes('remove') || lower.includes('clean'),
      canModifyDeps: lower.includes('install') || lower.includes('package') || lower.includes('dependency'),
      canModifySchema: lower.includes('database') || lower.includes('schema') || lower.includes('table') || lower.includes('migration'),
    };
  }
}

// =============================================================================
// SCOPE LOCK CACHE
// =============================================================================

const scopeLockCache = new Map<string, ScopeLock>();

export const ScopeLockCache = {
  get: (sessionId: string): ScopeLock | null => scopeLockCache.get(sessionId) || null,

  set: (sessionId: string, lock: ScopeLock): void => {
    scopeLockCache.set(sessionId, lock);
  },

  addViolation: (sessionId: string, violation: ScopeViolation): void => {
    const lock = scopeLockCache.get(sessionId);
    if (lock) {
      lock.violations.push(violation);
    }
  },

  clear: (sessionId: string): void => {
    scopeLockCache.delete(sessionId);
  },

  isActive: (sessionId: string): boolean => {
    const lock = scopeLockCache.get(sessionId);
    return lock?.isActive ?? false;
  },
};
