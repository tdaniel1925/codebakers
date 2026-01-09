import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ProjectStateManager - 100% ENFORCED State Management
 *
 * This service manages all project state files and ensures they are
 * ALWAYS up to date. The AI cannot skip or forget these - the extension
 * handles them directly.
 *
 * Files managed:
 * - .codebakers.json - Project configuration and build state
 * - .codebakers/DEVLOG.md - Development history
 * - .codebakers/PROJECT-STATE.md - Current work summary
 * - .codebakers/CONTEXT.md - Context for AI (anti-compaction)
 */

export interface UserPreferences {
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredInputMethod: 'chat' | 'form' | 'mockups' | 'example';
  autoApply: boolean;
  verboseExplanations: boolean;
}

export interface ProjectConfig {
  version: string;
  projectType: 'new' | 'existing';
  projectName: string;
  createdAt: string;
  lastUpdated: string;

  // User preferences
  userPreferences: UserPreferences;

  // Stack information
  stack: {
    framework?: string;
    database?: string;
    auth?: string;
    ui?: string;
    payments?: string[];
    detected: boolean;
  };

  // Build state
  build?: {
    id: string;
    status: 'planning' | 'in_progress' | 'paused' | 'completed';
    currentPhase: number;
    totalPhases: number;
    phases: Array<{
      name: string;
      status: 'pending' | 'in_progress' | 'completed';
      tasks: string[];
    }>;
  };

  // Current work (for session continuity)
  currentWork?: {
    lastUpdated: string;
    activeFeature: string;
    status: 'in_progress' | 'paused' | 'blocked';
    summary: string;
    pendingTasks: string[];
    filesModified: string[];
  };

  // Discovery answers (from onboarding)
  discovery?: {
    projectDescription: string;
    targetUsers: string;
    keyFeatures: string[];
    needsAuth: boolean;
    needsPayments: boolean;
    additionalNotes?: string;
  };

  // Onboarding completed flag
  onboardingCompleted: boolean;
}

export interface DevlogEntry {
  date: string;
  title: string;
  sessionId: string;
  taskSize: 'trivial' | 'small' | 'medium' | 'large';
  status: 'completed' | 'in_progress' | 'blocked';
  whatWasDone: string[];
  filesChanged: Array<{ path: string; change: string }>;
  nextSteps?: string[];
  blockers?: string[];
}

export interface ProjectState {
  lastUpdated: string;
  inProgress: string;
  blockers: string[];
  nextUp: string[];
  recentDecisions: Array<{ decision: string; reason: string; date: string }>;
  stackSummary: string;
}

export class ProjectStateManager {
  private workspaceRoot: string;
  private codebakersDir: string;
  private configPath: string;
  private devlogPath: string;
  private statePath: string;
  private contextPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.codebakersDir = path.join(workspaceRoot, '.codebakers');
    this.configPath = path.join(workspaceRoot, '.codebakers.json');
    this.devlogPath = path.join(this.codebakersDir, 'DEVLOG.md');
    this.statePath = path.join(this.codebakersDir, 'PROJECT-STATE.md');
    this.contextPath = path.join(this.codebakersDir, 'CONTEXT.md');
  }

  /**
   * Initialize project state - called on extension activation
   */
  async initialize(): Promise<{ isNew: boolean; needsOnboarding: boolean; config: ProjectConfig | null }> {
    // Ensure .codebakers directory exists
    if (!fs.existsSync(this.codebakersDir)) {
      fs.mkdirSync(this.codebakersDir, { recursive: true });
    }

    // Check if config exists
    const configExists = fs.existsSync(this.configPath);

    if (configExists) {
      const config = this.loadConfig();
      return {
        isNew: false,
        needsOnboarding: !config?.onboardingCompleted,
        config
      };
    }

    // Check if this is an existing project (has package.json)
    const hasPackageJson = fs.existsSync(path.join(this.workspaceRoot, 'package.json'));

    return {
      isNew: !hasPackageJson,
      needsOnboarding: true,
      config: null
    };
  }

  /**
   * Detect existing project stack from package.json
   */
  detectStack(): ProjectConfig['stack'] {
    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return { detected: false };
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const stack: ProjectConfig['stack'] = { detected: true };

      // Framework detection
      if (deps['next']) stack.framework = 'Next.js';
      else if (deps['react']) stack.framework = 'React';
      else if (deps['vue']) stack.framework = 'Vue';
      else if (deps['@angular/core']) stack.framework = 'Angular';
      else if (deps['express']) stack.framework = 'Express';

      // Database/ORM detection
      if (deps['drizzle-orm']) stack.database = 'Drizzle';
      else if (deps['prisma'] || deps['@prisma/client']) stack.database = 'Prisma';
      else if (deps['typeorm']) stack.database = 'TypeORM';
      else if (deps['mongoose']) stack.database = 'MongoDB/Mongoose';
      else if (deps['pg']) stack.database = 'PostgreSQL';

      // Auth detection
      if (deps['@supabase/supabase-js']) stack.auth = 'Supabase';
      else if (deps['next-auth'] || deps['@auth/core']) stack.auth = 'NextAuth';
      else if (deps['@clerk/nextjs']) stack.auth = 'Clerk';
      else if (deps['firebase']) stack.auth = 'Firebase';

      // UI detection
      if (deps['tailwindcss']) stack.ui = 'Tailwind';
      if (deps['@radix-ui/react-slot'] || deps['class-variance-authority']) {
        stack.ui = (stack.ui ? stack.ui + ' + ' : '') + 'shadcn/ui';
      }
      else if (deps['@chakra-ui/react']) stack.ui = 'Chakra UI';
      else if (deps['@mui/material']) stack.ui = 'Material UI';

      // Payments detection
      const payments: string[] = [];
      if (deps['stripe'] || deps['@stripe/stripe-js']) payments.push('Stripe');
      if (deps['@paypal/react-paypal-js']) payments.push('PayPal');
      if (deps['square']) payments.push('Square');
      if (payments.length > 0) stack.payments = payments;

      return stack;
    } catch {
      return { detected: false };
    }
  }

  /**
   * Create initial project config after onboarding
   */
  createConfig(
    projectName: string,
    projectType: 'new' | 'existing',
    userPreferences: UserPreferences,
    discovery?: ProjectConfig['discovery']
  ): ProjectConfig {
    const now = new Date().toISOString();
    const stack = this.detectStack();

    const config: ProjectConfig = {
      version: '1.0',
      projectType,
      projectName,
      createdAt: now,
      lastUpdated: now,
      userPreferences,
      stack,
      onboardingCompleted: true,
      discovery
    };

    this.saveConfig(config);
    return config;
  }

  /**
   * Load config from file
   */
  loadConfig(): ProjectConfig | null {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    return null;
  }

  /**
   * Save config to file
   */
  saveConfig(config: ProjectConfig): void {
    config.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Update current work state - called during/after AI interactions
   */
  updateCurrentWork(work: Partial<ProjectConfig['currentWork']>): void {
    const config = this.loadConfig();
    if (!config) return;

    config.currentWork = {
      ...config.currentWork,
      ...work,
      lastUpdated: new Date().toISOString()
    } as ProjectConfig['currentWork'];

    this.saveConfig(config);
    this.updateProjectState();
    this.updateContextFile();
  }

  /**
   * Add devlog entry - ENFORCED after each session
   */
  addDevlogEntry(entry: Omit<DevlogEntry, 'date' | 'sessionId'>): void {
    const now = new Date();
    const fullEntry: DevlogEntry = {
      ...entry,
      date: now.toISOString().split('T')[0],
      sessionId: `session_${now.getTime()}`
    };

    let content = '';

    // Read existing devlog
    if (fs.existsSync(this.devlogPath)) {
      content = fs.readFileSync(this.devlogPath, 'utf-8');
    } else {
      content = '# Development Log\n\n';
    }

    // Prepend new entry (newest first)
    const entryMd = this.formatDevlogEntry(fullEntry);
    const headerEnd = content.indexOf('\n\n') + 2;
    content = content.slice(0, headerEnd) + entryMd + '\n---\n\n' + content.slice(headerEnd);

    fs.writeFileSync(this.devlogPath, content);
  }

  private formatDevlogEntry(entry: DevlogEntry): string {
    let md = `## ${entry.date} - ${entry.title}\n`;
    md += `**Session:** ${entry.sessionId}\n`;
    md += `**Task Size:** ${entry.taskSize.toUpperCase()}\n`;
    md += `**Status:** ${entry.status}\n\n`;

    md += `### What was done:\n`;
    entry.whatWasDone.forEach(item => {
      md += `- ${item}\n`;
    });

    if (entry.filesChanged.length > 0) {
      md += `\n### Files changed:\n`;
      entry.filesChanged.forEach(file => {
        md += `- \`${file.path}\` - ${file.change}\n`;
      });
    }

    if (entry.nextSteps && entry.nextSteps.length > 0) {
      md += `\n### Next steps:\n`;
      entry.nextSteps.forEach(step => {
        md += `- ${step}\n`;
      });
    }

    if (entry.blockers && entry.blockers.length > 0) {
      md += `\n### Blockers:\n`;
      entry.blockers.forEach(blocker => {
        md += `- ${blocker}\n`;
      });
    }

    return md;
  }

  /**
   * Update PROJECT-STATE.md - human-readable current state
   */
  updateProjectState(): void {
    const config = this.loadConfig();
    if (!config) return;

    let md = `# Project State\n`;
    md += `> Last updated: ${new Date().toISOString()}\n\n`;

    md += `## Project: ${config.projectName}\n\n`;

    // Stack summary
    if (config.stack.detected) {
      md += `## Stack\n`;
      if (config.stack.framework) md += `- **Framework:** ${config.stack.framework}\n`;
      if (config.stack.database) md += `- **Database:** ${config.stack.database}\n`;
      if (config.stack.auth) md += `- **Auth:** ${config.stack.auth}\n`;
      if (config.stack.ui) md += `- **UI:** ${config.stack.ui}\n`;
      if (config.stack.payments) md += `- **Payments:** ${config.stack.payments.join(', ')}\n`;
      md += '\n';
    }

    // Current work
    if (config.currentWork) {
      md += `## In Progress\n`;
      md += `**${config.currentWork.activeFeature}** (${config.currentWork.status})\n\n`;
      md += `${config.currentWork.summary}\n\n`;

      if (config.currentWork.pendingTasks.length > 0) {
        md += `### Pending Tasks:\n`;
        config.currentWork.pendingTasks.forEach(task => {
          md += `- [ ] ${task}\n`;
        });
        md += '\n';
      }

      if (config.currentWork.filesModified.length > 0) {
        md += `### Recently Modified:\n`;
        config.currentWork.filesModified.slice(0, 10).forEach(file => {
          md += `- ${file}\n`;
        });
        md += '\n';
      }
    }

    // Build state
    if (config.build) {
      md += `## Build Progress\n`;
      md += `Phase ${config.build.currentPhase}/${config.build.totalPhases}: ${config.build.status}\n\n`;
      config.build.phases.forEach((phase, i) => {
        const icon = phase.status === 'completed' ? '✅' : phase.status === 'in_progress' ? '🔄' : '⏳';
        md += `${icon} **Phase ${i + 1}: ${phase.name}**\n`;
      });
      md += '\n';
    }

    // Discovery info
    if (config.discovery) {
      md += `## Project Overview\n`;
      md += `${config.discovery.projectDescription}\n\n`;
      md += `**Target Users:** ${config.discovery.targetUsers}\n\n`;
      md += `**Key Features:**\n`;
      config.discovery.keyFeatures.forEach(f => {
        md += `- ${f}\n`;
      });
      md += '\n';
    }

    fs.writeFileSync(this.statePath, md);
  }

  /**
   * Update CONTEXT.md - Injected into AI messages to survive compaction
   */
  updateContextFile(): void {
    const config = this.loadConfig();
    if (!config) return;

    let md = `# CodeBakers Context (Auto-Generated)\n`;
    md += `> This file is automatically maintained. Do not edit manually.\n`;
    md += `> Last updated: ${new Date().toISOString()}\n\n`;

    md += `## CRITICAL: Read This First\n`;
    md += `If this conversation was just compacted/resumed, READ THIS FILE to restore context.\n\n`;

    md += `## Project: ${config.projectName}\n`;
    md += `- Type: ${config.projectType}\n`;
    md += `- User Skill: ${config.userPreferences.skillLevel}\n\n`;

    // Stack
    if (config.stack.detected) {
      md += `## Established Stack (DO NOT CHANGE)\n`;
      if (config.stack.framework) md += `- Framework: ${config.stack.framework}\n`;
      if (config.stack.database) md += `- Database/ORM: ${config.stack.database}\n`;
      if (config.stack.auth) md += `- Auth: ${config.stack.auth}\n`;
      if (config.stack.ui) md += `- UI: ${config.stack.ui}\n`;
      md += '\n';
    }

    // Current work
    if (config.currentWork) {
      md += `## Current Work\n`;
      md += `- **Active:** ${config.currentWork.activeFeature}\n`;
      md += `- **Status:** ${config.currentWork.status}\n`;
      md += `- **Summary:** ${config.currentWork.summary}\n`;
      if (config.currentWork.pendingTasks.length > 0) {
        md += `- **Next:** ${config.currentWork.pendingTasks[0]}\n`;
      }
      md += '\n';
    }

    // Discovery
    if (config.discovery) {
      md += `## Project Requirements\n`;
      md += config.discovery.projectDescription + '\n';
      md += `- Users: ${config.discovery.targetUsers}\n`;
      md += `- Auth Required: ${config.discovery.needsAuth ? 'Yes' : 'No'}\n`;
      md += `- Payments Required: ${config.discovery.needsPayments ? 'Yes' : 'No'}\n`;
      md += '\n';
    }

    // User preferences for AI behavior
    md += `## User Preferences (Adjust Behavior)\n`;
    md += `- Skill Level: ${config.userPreferences.skillLevel}\n`;
    md += `- Explanations: ${config.userPreferences.verboseExplanations ? 'Detailed' : 'Minimal'}\n`;
    md += `- Auto Apply: ${config.userPreferences.autoApply ? 'Yes' : 'Ask first'}\n`;
    md += '\n';

    // Instructions for AI
    md += `## Instructions for AI\n`;
    md += `1. Follow the established stack above - do not suggest alternatives\n`;
    md += `2. Continue from "Current Work" if resuming\n`;
    md += `3. Adjust verbosity based on skill level\n`;
    md += `4. Use patterns from .claude/ folder\n`;
    md += `5. Update progress via the CodeBakers extension\n`;

    fs.writeFileSync(this.contextPath, md);
  }

  /**
   * Get context for injection into AI messages
   */
  getContextForAI(): string {
    if (fs.existsSync(this.contextPath)) {
      return fs.readFileSync(this.contextPath, 'utf-8');
    }
    return '';
  }

  /**
   * Get the most recent devlog entry
   */
  getLatestDevlogEntry(): string | null {
    if (!fs.existsSync(this.devlogPath)) return null;

    const content = fs.readFileSync(this.devlogPath, 'utf-8');
    const entries = content.split('\n---\n');
    if (entries.length > 0) {
      // Return the first entry after the header
      return entries[0];
    }
    return null;
  }

  /**
   * Check if project needs session recovery (after compaction)
   */
  needsSessionRecovery(): boolean {
    const config = this.loadConfig();
    if (!config?.currentWork) return false;

    const lastUpdate = new Date(config.currentWork.lastUpdated);
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

    // If last update was more than 1 hour ago, likely a new session
    return hoursSinceUpdate > 1;
  }

  /**
   * Generate session recovery message
   */
  getSessionRecoveryMessage(): string {
    const config = this.loadConfig();
    if (!config) return '';

    let msg = `📋 **Session Resumed**\n`;
    msg += `- **Project:** ${config.projectName}\n`;

    if (config.currentWork) {
      msg += `- **Active Task:** ${config.currentWork.activeFeature}\n`;
      msg += `- **Status:** ${config.currentWork.status}\n`;
      msg += `- **Last Work:** ${config.currentWork.summary}\n`;
    }

    if (config.build) {
      msg += `- **Build:** Phase ${config.build.currentPhase}/${config.build.totalPhases}\n`;
    }

    return msg;
  }

  /**
   * Start a new work session
   */
  startWorkSession(featureName: string, summary: string): void {
    this.updateCurrentWork({
      activeFeature: featureName,
      status: 'in_progress',
      summary,
      pendingTasks: [],
      filesModified: []
    });
  }

  /**
   * Record a file modification
   */
  recordFileModification(filePath: string): void {
    const config = this.loadConfig();
    if (!config?.currentWork) return;

    const relativePath = path.relative(this.workspaceRoot, filePath);
    if (!config.currentWork.filesModified.includes(relativePath)) {
      config.currentWork.filesModified.push(relativePath);
      this.saveConfig(config);
    }
  }

  /**
   * Complete current work session
   */
  completeWorkSession(whatWasDone: string[], nextSteps?: string[]): void {
    const config = this.loadConfig();
    if (!config?.currentWork) return;

    // Add devlog entry
    this.addDevlogEntry({
      title: config.currentWork.activeFeature,
      taskSize: 'medium', // Could be smarter about this
      status: 'completed',
      whatWasDone,
      filesChanged: config.currentWork.filesModified.map(p => ({
        path: p,
        change: 'modified'
      })),
      nextSteps
    });

    // Clear current work
    config.currentWork = undefined;
    this.saveConfig(config);
    this.updateProjectState();
    this.updateContextFile();
  }
}
