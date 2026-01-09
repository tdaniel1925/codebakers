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
   * Get default CLAUDE.md content
   */
  private getDefaultClaudeMd(): string {
    return `# CodeBakers Patterns

> Production-ready code patterns for AI assistants

## Instructions

Before writing ANY code:
1. Check for pattern files in \`.claude/\` directory
2. Read and follow the patterns exactly
3. Use existing code patterns from the codebase
4. Write tests for any new functionality

## Available Patterns

Check the \`.claude/\` folder for available pattern modules.

## Commands

- \`/build\` - Create entire project from idea
- \`/feature\` - Add capability to existing project
- \`/audit\` - Review code quality
- \`/status\` - See project progress

---

For full patterns, sign in at https://codebakers.ai
`;
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
