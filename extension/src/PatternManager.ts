/**
 * PatternManager - Manages CodeBakers pattern files
 *
 * Responsibilities:
 * - Sync CLAUDE.md and .cursorrules
 * - Download/update patterns from server
 * - Detect pattern files in workspace
 * - Validate pattern compliance
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface PatternStatus {
  hasClaudeMd: boolean;
  hasCursorRules: boolean;
  hasClaudeFolder: boolean;
  patternCount: number;
  lastUpdated: string | null;
  inSync: boolean;
}

export type WarningSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface PatternWarning {
  severity: WarningSeverity;
  title: string;
  message: string;
  action?: string;
  actionCommand?: string;
}

export interface PatternHealth {
  score: number; // 0-100
  warnings: PatternWarning[];
  enforceability: 'strong' | 'moderate' | 'weak' | 'none';
}

export class PatternManager {
  private workspaceRoot: string;
  private claudeMdPath: string;
  private cursorRulesPath: string;
  private claudeFolderPath: string;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.claudeMdPath = path.join(this.workspaceRoot, 'CLAUDE.md');
    this.cursorRulesPath = path.join(this.workspaceRoot, '.cursorrules');
    this.claudeFolderPath = path.join(this.workspaceRoot, '.claude');
  }

  /**
   * Get current pattern status
   */
  getStatus(): PatternStatus {
    const hasClaudeMd = fs.existsSync(this.claudeMdPath);
    const hasCursorRules = fs.existsSync(this.cursorRulesPath);
    const hasClaudeFolder = fs.existsSync(this.claudeFolderPath);

    let patternCount = 0;
    if (hasClaudeFolder) {
      try {
        const files = fs.readdirSync(this.claudeFolderPath);
        patternCount = files.filter(f => f.endsWith('.md')).length;
      } catch (e) {
        console.error('Error reading .claude folder:', e);
      }
    }

    let lastUpdated: string | null = null;
    if (hasClaudeMd) {
      try {
        const stats = fs.statSync(this.claudeMdPath);
        lastUpdated = stats.mtime.toISOString();
      } catch (e) {
        // Ignore
      }
    }

    // Check if CLAUDE.md and .cursorrules are in sync
    let inSync = true;
    if (hasClaudeMd && hasCursorRules) {
      try {
        const claudeContent = fs.readFileSync(this.claudeMdPath, 'utf-8');
        const cursorContent = fs.readFileSync(this.cursorRulesPath, 'utf-8');
        inSync = claudeContent === cursorContent;
      } catch (e) {
        inSync = false;
      }
    } else if (hasClaudeMd !== hasCursorRules) {
      inSync = false;
    }

    return {
      hasClaudeMd,
      hasCursorRules,
      hasClaudeFolder,
      patternCount,
      lastUpdated,
      inSync
    };
  }

  /**
   * Sync CLAUDE.md to .cursorrules (or vice versa)
   */
  async syncPatternFiles(): Promise<boolean> {
    try {
      const hasClaudeMd = fs.existsSync(this.claudeMdPath);
      const hasCursorRules = fs.existsSync(this.cursorRulesPath);

      if (hasClaudeMd && !hasCursorRules) {
        // Copy CLAUDE.md to .cursorrules
        const content = fs.readFileSync(this.claudeMdPath, 'utf-8');
        fs.writeFileSync(this.cursorRulesPath, content);
        vscode.window.showInformationMessage('Synced CLAUDE.md to .cursorrules');
        return true;
      }

      if (!hasClaudeMd && hasCursorRules) {
        // Copy .cursorrules to CLAUDE.md
        const content = fs.readFileSync(this.cursorRulesPath, 'utf-8');
        fs.writeFileSync(this.claudeMdPath, content);
        vscode.window.showInformationMessage('Synced .cursorrules to CLAUDE.md');
        return true;
      }

      if (hasClaudeMd && hasCursorRules) {
        // Both exist - use CLAUDE.md as source of truth
        const claudeContent = fs.readFileSync(this.claudeMdPath, 'utf-8');
        const cursorContent = fs.readFileSync(this.cursorRulesPath, 'utf-8');

        if (claudeContent !== cursorContent) {
          fs.writeFileSync(this.cursorRulesPath, claudeContent);
          vscode.window.showInformationMessage('Synced CLAUDE.md to .cursorrules');
          return true;
        } else {
          vscode.window.showInformationMessage('Pattern files already in sync');
          return true;
        }
      }

      vscode.window.showWarningMessage('No pattern files found. Run "CodeBakers: Initialize Patterns" first.');
      return false;
    } catch (error) {
      console.error('Error syncing pattern files:', error);
      vscode.window.showErrorMessage(`Failed to sync pattern files: ${error}`);
      return false;
    }
  }

  /**
   * Initialize patterns in the workspace (download from server or create defaults)
   */
  async initializePatterns(apiKey?: string): Promise<boolean> {
    try {
      // Create .claude folder if it doesn't exist
      if (!fs.existsSync(this.claudeFolderPath)) {
        fs.mkdirSync(this.claudeFolderPath, { recursive: true });
      }

      // If we have an API key, try to download from server
      if (apiKey) {
        const downloaded = await this.downloadPatterns(apiKey);
        if (downloaded) return true;
      }

      // Create a basic CLAUDE.md if none exists
      if (!fs.existsSync(this.claudeMdPath)) {
        const defaultContent = this.getDefaultClaudeMd();
        fs.writeFileSync(this.claudeMdPath, defaultContent);
      }

      // Sync to .cursorrules
      await this.syncPatternFiles();

      vscode.window.showInformationMessage('CodeBakers patterns initialized!');
      return true;
    } catch (error) {
      console.error('Error initializing patterns:', error);
      vscode.window.showErrorMessage(`Failed to initialize patterns: ${error}`);
      return false;
    }
  }

  /**
   * Download patterns from CodeBakers server
   */
  async downloadPatterns(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://codebakers.ai/api/patterns/download', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json() as any;

      // Write CLAUDE.md
      if (data.claudeMd) {
        fs.writeFileSync(this.claudeMdPath, data.claudeMd);
      }

      // Write pattern modules to .claude/
      if (data.modules && Array.isArray(data.modules)) {
        for (const module of data.modules) {
          const modulePath = path.join(this.claudeFolderPath, module.name);
          fs.writeFileSync(modulePath, module.content);
        }
      }

      // Sync to .cursorrules
      await this.syncPatternFiles();

      vscode.window.showInformationMessage(`Downloaded ${data.modules?.length || 0} pattern modules`);
      return true;
    } catch (error) {
      console.error('Error downloading patterns:', error);
      return false;
    }
  }

  /**
   * Update patterns from server
   */
  async updatePatterns(apiKey: string): Promise<boolean> {
    const downloaded = await this.downloadPatterns(apiKey);
    if (downloaded) {
      vscode.window.showInformationMessage('Patterns updated successfully!');
    } else {
      vscode.window.showWarningMessage('Failed to update patterns from server');
    }
    return downloaded;
  }

  /**
   * Open CLAUDE.md in editor
   */
  async openClaudeMd(): Promise<void> {
    if (fs.existsSync(this.claudeMdPath)) {
      const doc = await vscode.workspace.openTextDocument(this.claudeMdPath);
      await vscode.window.showTextDocument(doc);
    } else {
      vscode.window.showWarningMessage('CLAUDE.md not found. Run "CodeBakers: Initialize Patterns" first.');
    }
  }

  /**
   * Get default CLAUDE.md content - v6.15 Short template
   * Rules at START and END for better AI attention
   */
  private getDefaultClaudeMd(): string {
    return `# CodeBakers v6.15

## 🚨 ALWAYS DO THIS (Critical - Read First)
1. ALWAYS call \`project_status()\` FIRST → If works show "🍪 CodeBakers is working..." / If fails show "⚠️ Not connected"
2. ALWAYS call \`discover_patterns({ task: "..." })\` BEFORE writing any code
3. ALWAYS call \`validate_complete({ feature: "...", files: [...] })\` BEFORE saying "done"
4. ALWAYS show footer after code: \`🍪 **CodeBakers** | Patterns: X | TSC: ✅ | Tests: ✅\`

## ❌ NEVER DO THIS
1. NEVER write code without calling discover_patterns first
2. NEVER say "done" without validate_complete passing
3. NEVER show the success header without project_status succeeding first
4. NEVER skip writing tests for new features

## Quick Reference
\`\`\`
project_status()                                    → Verify connection FIRST
discover_patterns({ task: "what you're building" }) → Get patterns BEFORE code
validate_complete({ feature: "name", files: [...] }) → Validate BEFORE done
\`\`\`

Header (after project_status succeeds): 🍪 CodeBakers is working on this...
Header (if project_status fails): ⚠️ CodeBakers not connected - run: codebakers go
Footer (after code): 🍪 **CodeBakers** | Patterns: X | TSC: ✅ | Tests: ✅

## 🚨 ALWAYS DO THIS (Critical - Repeated at End)
1. Call \`project_status()\` FIRST
2. Call \`discover_patterns()\` before code
3. Call \`validate_complete()\` before done
4. Show footer after code responses
`;
  }

  /**
   * Check pattern health and return warnings
   */
  checkPatternHealth(): PatternHealth {
    const status = this.getStatus();
    const warnings: PatternWarning[] = [];
    let score = 100;

    // CRITICAL: No CLAUDE.md at all
    if (!status.hasClaudeMd) {
      warnings.push({
        severity: 'critical',
        title: 'No Pattern File',
        message: 'CLAUDE.md not found. AI tools have no rules to follow.',
        action: 'Initialize Patterns',
        actionCommand: 'codebakers.initPatterns'
      });
      score -= 50;
    } else {
      // Check CLAUDE.md content
      try {
        const content = fs.readFileSync(this.claudeMdPath, 'utf-8');

        // HIGH: Empty or minimal CLAUDE.md
        if (content.trim().length < 100) {
          warnings.push({
            severity: 'high',
            title: 'Minimal Patterns',
            message: 'CLAUDE.md is nearly empty. AI has very few rules to follow.',
            action: 'Update Patterns',
            actionCommand: 'codebakers.updatePatterns'
          });
          score -= 30;
        }

        // MEDIUM: Missing enforcement keywords
        const enforcementKeywords = [
          'MUST', 'ALWAYS', 'NEVER', 'REQUIRED', 'MANDATORY',
          'NOT ALLOWED', 'NON-NEGOTIABLE'
        ];
        const hasEnforcementLanguage = enforcementKeywords.some(kw =>
          content.toUpperCase().includes(kw)
        );

        if (!hasEnforcementLanguage) {
          warnings.push({
            severity: 'medium',
            title: 'Weak Enforcement Language',
            message: 'CLAUDE.md lacks strong enforcement words (MUST, ALWAYS, NEVER). AI may ignore soft suggestions.',
            action: 'Open CLAUDE.md',
            actionCommand: 'codebakers.openClaudeMd'
          });
          score -= 15;
        }

        // Check for Gate enforcement (MCP tools)
        const hasGateEnforcement = content.includes('discover_patterns') ||
                                    content.includes('validate_complete');
        if (!hasGateEnforcement) {
          warnings.push({
            severity: 'medium',
            title: 'No Gate Enforcement',
            message: 'No MCP tool gates found. Consider adding discover_patterns and validate_complete.',
            action: 'Update Patterns',
            actionCommand: 'codebakers.updatePatterns'
          });
          score -= 10;
        }

        // Check for pre-commit hook mention
        const hasPreCommitHook = content.includes('pre-commit') ||
                                  content.includes('validate-codebakers');
        if (!hasPreCommitHook) {
          warnings.push({
            severity: 'low',
            title: 'No Pre-Commit Validation',
            message: 'No pre-commit hook configured. Non-compliant code can be committed.',
            action: 'Open CLAUDE.md',
            actionCommand: 'codebakers.openClaudeMd'
          });
          score -= 5;
        }

      } catch (e) {
        console.error('Error reading CLAUDE.md:', e);
      }
    }

    // HIGH: Files out of sync
    if (!status.inSync && status.hasClaudeMd) {
      warnings.push({
        severity: 'high',
        title: 'Files Out of Sync',
        message: 'CLAUDE.md and .cursorrules differ. One AI tool may have different rules.',
        action: 'Sync Now',
        actionCommand: 'codebakers.syncPatterns'
      });
      score -= 20;
    }

    // MEDIUM: No pattern modules
    if (!status.hasClaudeFolder || status.patternCount === 0) {
      warnings.push({
        severity: 'medium',
        title: 'No Pattern Modules',
        message: 'No .claude/ folder or modules. Full CodeBakers patterns not installed.',
        action: 'Update Patterns',
        actionCommand: 'codebakers.updatePatterns'
      });
      score -= 10;
    }

    // LOW: Patterns are old (30+ days)
    if (status.lastUpdated) {
      const lastUpdate = new Date(status.lastUpdated);
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate > 30) {
        warnings.push({
          severity: 'low',
          title: 'Patterns May Be Outdated',
          message: `Patterns last updated ${Math.floor(daysSinceUpdate)} days ago. Consider updating.`,
          action: 'Update Patterns',
          actionCommand: 'codebakers.updatePatterns'
        });
        score -= 5;
      }
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine enforceability
    let enforceability: PatternHealth['enforceability'];
    if (score >= 80) {
      enforceability = 'strong';
    } else if (score >= 60) {
      enforceability = 'moderate';
    } else if (score >= 30) {
      enforceability = 'weak';
    } else {
      enforceability = 'none';
    }

    return { score, warnings, enforceability };
  }

  /**
   * Watch for pattern file changes
   */
  createFileWatcher(): vscode.FileSystemWatcher {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, '{CLAUDE.md,.cursorrules,.claude/**}')
    );

    watcher.onDidChange(() => {
      console.log('Pattern file changed');
    });

    watcher.onDidCreate(() => {
      console.log('Pattern file created');
    });

    watcher.onDidDelete(() => {
      console.log('Pattern file deleted');
    });

    return watcher;
  }
}
