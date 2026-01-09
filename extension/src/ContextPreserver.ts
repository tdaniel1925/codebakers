/**
 * ContextPreserver - Anti-Compaction System
 *
 * Ensures AI context survives long chat sessions by maintaining
 * file-based memory that can be recovered after context compaction.
 *
 * Features:
 * - Maintains CONTEXT.md with current state
 * - Detects compaction events
 * - Provides recovery instructions
 * - Rolling history of recent actions
 * - Message count tracking
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectStateManager, ProjectConfig } from './ProjectStateManager';

export interface ContextSnapshot {
  timestamp: string;
  messageCount: number;
  activeTask: string | null;
  recentActions: string[];
  pendingTasks: string[];
  importantContext: string[];
  lastUserRequest: string | null;
}

export interface RecoveryData {
  needsRecovery: boolean;
  reason: string | null;
  snapshot: ContextSnapshot | null;
  recoveryMessage: string | null;
}

export class ContextPreserver {
  private workspaceRoot: string;
  private codebakersDir: string;
  private contextFile: string;
  private messageCount: number = 0;
  private lastSnapshot: ContextSnapshot | null = null;
  private recentActions: string[] = [];
  private stateManager: ProjectStateManager;

  // Compaction detection thresholds
  private readonly COMPACTION_MESSAGE_THRESHOLD = 50;
  private readonly ACTION_HISTORY_SIZE = 20;
  private readonly CONTEXT_UPDATE_INTERVAL = 5; // Update every 5 messages

  constructor(stateManager: ProjectStateManager) {
    this.stateManager = stateManager;
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.codebakersDir = path.join(this.workspaceRoot, '.codebakers');
    this.contextFile = path.join(this.codebakersDir, 'CONTEXT.md');
  }

  /**
   * Initialize the context preserver
   */
  async initialize(): Promise<void> {
    // Ensure .codebakers directory exists
    if (!fs.existsSync(this.codebakersDir)) {
      fs.mkdirSync(this.codebakersDir, { recursive: true });
    }

    // Load existing snapshot if available
    this.loadSnapshot();
  }

  /**
   * Record a message and update context
   */
  recordMessage(role: 'user' | 'assistant', content: string): void {
    this.messageCount++;

    // Update context file periodically
    if (this.messageCount % this.CONTEXT_UPDATE_INTERVAL === 0) {
      this.updateContextFile();
    }

    // Check for potential compaction
    if (this.messageCount > this.COMPACTION_MESSAGE_THRESHOLD) {
      this.prepareForCompaction();
    }
  }

  /**
   * Record an action taken by the AI
   */
  recordAction(action: string): void {
    this.recentActions.unshift(action);

    // Keep rolling history
    if (this.recentActions.length > this.ACTION_HISTORY_SIZE) {
      this.recentActions = this.recentActions.slice(0, this.ACTION_HISTORY_SIZE);
    }

    // Update context file
    this.updateContextFile();
  }

  /**
   * Record current task being worked on
   */
  recordActiveTask(task: string | null): void {
    if (this.lastSnapshot) {
      this.lastSnapshot.activeTask = task;
    }
    this.updateContextFile();
  }

  /**
   * Record user's request for recovery
   */
  recordUserRequest(request: string): void {
    if (this.lastSnapshot) {
      this.lastSnapshot.lastUserRequest = request;
    }
  }

  /**
   * Add important context that must survive compaction
   */
  addImportantContext(context: string): void {
    if (!this.lastSnapshot) {
      this.createSnapshot();
    }

    if (this.lastSnapshot && !this.lastSnapshot.importantContext.includes(context)) {
      this.lastSnapshot.importantContext.push(context);

      // Keep limited size
      if (this.lastSnapshot.importantContext.length > 10) {
        this.lastSnapshot.importantContext = this.lastSnapshot.importantContext.slice(-10);
      }
    }

    this.updateContextFile();
  }

  /**
   * Check if recovery is needed (call at start of new messages)
   */
  checkRecovery(firstMessage: string): RecoveryData {
    // Indicators that suggest compaction just happened
    const compactionIndicators = [
      'context was compacted',
      'conversation summary',
      'previous conversation',
      'continuing from',
      'session was summarized'
    ];

    const messageLower = firstMessage.toLowerCase();
    const isCompactionMessage = compactionIndicators.some(ind =>
      messageLower.includes(ind)
    );

    // Also check if this looks like a fresh start but we have context
    const existingSnapshot = this.loadSnapshot();
    const hasExistingContext = existingSnapshot !== null;
    const isShortSession = this.messageCount < 3;

    if ((isCompactionMessage || (hasExistingContext && isShortSession)) && existingSnapshot) {
      return {
        needsRecovery: true,
        reason: isCompactionMessage
          ? 'Context compaction detected'
          : 'New session with existing project state',
        snapshot: existingSnapshot,
        recoveryMessage: this.generateRecoveryMessage(existingSnapshot)
      };
    }

    return {
      needsRecovery: false,
      reason: null,
      snapshot: null,
      recoveryMessage: null
    };
  }

  /**
   * Get context to inject into AI messages
   */
  getContextForInjection(): string {
    const config = this.stateManager.loadConfig();
    if (!config) return '';

    const snapshot = this.lastSnapshot || this.createSnapshot();

    let context = `
## Current Project Context

**Project:** ${config.projectName}
**Type:** ${config.projectType}
**Skill Level:** ${config.userPreferences.skillLevel}
**Stack:** ${config.stack.framework || 'Next.js'} + ${config.stack.database || 'Drizzle'} + ${config.stack.auth || 'Supabase'}

`;

    // Add current work if any
    if (config.currentWork?.activeFeature) {
      context += `
### Active Work
**Feature:** ${config.currentWork.activeFeature}
**Status:** ${config.currentWork.status}
**Summary:** ${config.currentWork.summary}

`;
    }

    // Add recent actions
    if (snapshot.recentActions.length > 0) {
      context += `
### Recent Actions
${snapshot.recentActions.slice(0, 5).map(a => `- ${a}`).join('\n')}

`;
    }

    // Add pending tasks
    if (snapshot.pendingTasks.length > 0) {
      context += `
### Pending Tasks
${snapshot.pendingTasks.map(t => `- ${t}`).join('\n')}

`;
    }

    // Add important context
    if (snapshot.importantContext.length > 0) {
      context += `
### Important Context
${snapshot.importantContext.map(c => `- ${c}`).join('\n')}

`;
    }

    return context;
  }

  /**
   * Prepare for potential compaction by saving state
   */
  private prepareForCompaction(): void {
    console.log('ContextPreserver: Preparing for potential compaction');
    this.createSnapshot();
    this.updateContextFile();
    this.stateManager.updateProjectState();
  }

  /**
   * Create a snapshot of current context
   */
  private createSnapshot(): ContextSnapshot {
    const config = this.stateManager.loadConfig();

    this.lastSnapshot = {
      timestamp: new Date().toISOString(),
      messageCount: this.messageCount,
      activeTask: config?.currentWork?.activeFeature || null,
      recentActions: [...this.recentActions],
      pendingTasks: config?.currentWork?.pendingTasks || [],
      importantContext: this.lastSnapshot?.importantContext || [],
      lastUserRequest: this.lastSnapshot?.lastUserRequest || null
    };

    return this.lastSnapshot;
  }

  /**
   * Load snapshot from disk
   */
  private loadSnapshot(): ContextSnapshot | null {
    try {
      if (!fs.existsSync(this.contextFile)) {
        return null;
      }

      const content = fs.readFileSync(this.contextFile, 'utf-8');

      // Parse the markdown file to extract snapshot data
      const snapshot: ContextSnapshot = {
        timestamp: '',
        messageCount: 0,
        activeTask: null,
        recentActions: [],
        pendingTasks: [],
        importantContext: [],
        lastUserRequest: null
      };

      // Extract timestamp
      const timestampMatch = content.match(/Last Updated:\s*(.+)/);
      if (timestampMatch) {
        snapshot.timestamp = timestampMatch[1];
      }

      // Extract active task
      const taskMatch = content.match(/Active Task:\s*(.+)/);
      if (taskMatch && taskMatch[1] !== 'None') {
        snapshot.activeTask = taskMatch[1];
      }

      // Extract recent actions
      const actionsMatch = content.match(/## Recent Actions\n([\s\S]*?)(?=\n## |$)/);
      if (actionsMatch) {
        snapshot.recentActions = actionsMatch[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.replace(/^- /, ''));
      }

      // Extract pending tasks
      const pendingMatch = content.match(/## Pending Tasks\n([\s\S]*?)(?=\n## |$)/);
      if (pendingMatch) {
        snapshot.pendingTasks = pendingMatch[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.replace(/^- /, ''));
      }

      // Extract important context
      const importantMatch = content.match(/## Important Context\n([\s\S]*?)(?=\n## |$)/);
      if (importantMatch) {
        snapshot.importantContext = importantMatch[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.replace(/^- /, ''));
      }

      // Extract last user request
      const requestMatch = content.match(/Last User Request:\s*"(.+)"/);
      if (requestMatch) {
        snapshot.lastUserRequest = requestMatch[1];
      }

      this.lastSnapshot = snapshot;
      return snapshot;
    } catch (error) {
      console.error('Failed to load context snapshot:', error);
      return null;
    }
  }

  /**
   * Update the CONTEXT.md file
   */
  private updateContextFile(): void {
    const snapshot = this.lastSnapshot || this.createSnapshot();
    const config = this.stateManager.loadConfig();

    const content = `# CodeBakers Context File

**DO NOT DELETE** - This file helps the AI recover context after long sessions.

---

## Session Info

**Last Updated:** ${snapshot.timestamp}
**Message Count:** ${snapshot.messageCount}
**Active Task:** ${snapshot.activeTask || 'None'}
${snapshot.lastUserRequest ? `**Last User Request:** "${snapshot.lastUserRequest}"` : ''}

## Project Info

**Name:** ${config?.projectName || 'Unknown'}
**Type:** ${config?.projectType || 'unknown'}
**Skill Level:** ${config?.userPreferences?.skillLevel || 'intermediate'}

## Stack

- Framework: ${config?.stack?.framework || 'Not detected'}
- Database: ${config?.stack?.database || 'Not detected'}
- Auth: ${config?.stack?.auth || 'Not detected'}
- UI: ${config?.stack?.ui || 'Not detected'}

## Recent Actions

${snapshot.recentActions.length > 0
  ? snapshot.recentActions.map(a => `- ${a}`).join('\n')
  : '- No recent actions'}

## Pending Tasks

${snapshot.pendingTasks.length > 0
  ? snapshot.pendingTasks.map(t => `- ${t}`).join('\n')
  : '- No pending tasks'}

## Important Context

${snapshot.importantContext.length > 0
  ? snapshot.importantContext.map(c => `- ${c}`).join('\n')
  : '- No special context'}

## Current Work

${config?.currentWork ? `
**Feature:** ${config.currentWork.activeFeature}
**Status:** ${config.currentWork.status}
**Summary:** ${config.currentWork.summary}

### Files Modified:
${config.currentWork.filesModified?.map((f: string) => `- ${f}`).join('\n') || '- None'}

### Pending Sub-tasks:
${config.currentWork.pendingTasks?.map((t: string) => `- ${t}`).join('\n') || '- None'}
` : 'No active work session'}

---

## Recovery Instructions

If starting a new session, read:
1. This file (CONTEXT.md) - Current state
2. PROJECT-STATE.md - Work in progress
3. DEVLOG.md - Recent history
4. .codebakers.json - Project config

Then continue where you left off.
`;

    try {
      fs.writeFileSync(this.contextFile, content);
    } catch (error) {
      console.error('Failed to update context file:', error);
    }
  }

  /**
   * Generate a recovery message for the AI
   */
  private generateRecoveryMessage(snapshot: ContextSnapshot): string {
    let message = `
## Session Recovery

Your context was compacted. Here's what you need to know:

`;

    if (snapshot.activeTask) {
      message += `**You were working on:** ${snapshot.activeTask}\n\n`;
    }

    if (snapshot.lastUserRequest) {
      message += `**Last user request:** "${snapshot.lastUserRequest}"\n\n`;
    }

    if (snapshot.recentActions.length > 0) {
      message += `**Recent actions:**\n`;
      snapshot.recentActions.slice(0, 5).forEach(action => {
        message += `- ${action}\n`;
      });
      message += '\n';
    }

    if (snapshot.pendingTasks.length > 0) {
      message += `**Pending tasks:**\n`;
      snapshot.pendingTasks.forEach(task => {
        message += `- ${task}\n`;
      });
      message += '\n';
    }

    if (snapshot.importantContext.length > 0) {
      message += `**Important context:**\n`;
      snapshot.importantContext.forEach(ctx => {
        message += `- ${ctx}\n`;
      });
      message += '\n';
    }

    message += `
Read the full context from:
- .codebakers/CONTEXT.md
- .codebakers/PROJECT-STATE.md
- .codebakers/DEVLOG.md

Continue with the user's current request while maintaining context.
`;

    return message;
  }

  /**
   * Force a context save (call before expected compaction)
   */
  forceSave(): void {
    this.createSnapshot();
    this.updateContextFile();
    this.stateManager.updateProjectState();
  }

  /**
   * Reset message count (call at session start)
   */
  resetMessageCount(): void {
    this.messageCount = 0;
  }

  /**
   * Get current message count
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Check if context is getting long (warn user)
   */
  isContextLong(): boolean {
    return this.messageCount > this.COMPACTION_MESSAGE_THRESHOLD * 0.8;
  }

  /**
   * Get warning message if context is getting long
   */
  getLongContextWarning(): string | null {
    if (!this.isContextLong()) return null;

    return `Note: This conversation is getting long (${this.messageCount} messages). ` +
           `Context is being saved to .codebakers/ files to preserve state if the session is compacted.`;
  }
}
