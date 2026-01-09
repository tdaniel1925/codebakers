/**
 * StatusBarManager - Manages the CodeBakers status bar indicator
 *
 * Shows:
 * - Pattern status (loaded/not loaded)
 * - Sync status (in sync/out of sync)
 * - Quick actions
 */

import * as vscode from 'vscode';
import { PatternManager, PatternStatus } from './PatternManager';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private patternManager: PatternManager;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(patternManager: PatternManager) {
    this.patternManager = patternManager;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );

    this.statusBarItem.command = 'codebakers.showMenu';
    this.update();
    this.statusBarItem.show();

    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => this.update(), 30000);
  }

  /**
   * Update the status bar based on current pattern status
   */
  update(): void {
    const status = this.patternManager.getStatus();

    if (!status.hasClaudeMd && !status.hasCursorRules) {
      // No patterns
      this.statusBarItem.text = '$(warning) CodeBakers';
      this.statusBarItem.tooltip = 'No patterns found. Click to initialize.';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (!status.inSync) {
      // Out of sync
      this.statusBarItem.text = '$(sync) CodeBakers';
      this.statusBarItem.tooltip = 'Pattern files out of sync. Click to sync.';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      // All good
      const moduleText = status.patternCount > 0 ? ` [${status.patternCount} modules]` : '';
      this.statusBarItem.text = `$(check) CodeBakers${moduleText}`;
      this.statusBarItem.tooltip = this.buildTooltip(status);
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  /**
   * Build detailed tooltip
   */
  private buildTooltip(status: PatternStatus): string {
    const lines = [
      'CodeBakers Patterns Active',
      '',
      `CLAUDE.md: ${status.hasClaudeMd ? 'Yes' : 'No'}`,
      `.cursorrules: ${status.hasCursorRules ? 'Yes' : 'No'}`,
      `.claude/ modules: ${status.patternCount}`,
      `In sync: ${status.inSync ? 'Yes' : 'No'}`,
      '',
      'Click for options'
    ];

    if (status.lastUpdated) {
      const date = new Date(status.lastUpdated);
      lines.splice(5, 0, `Last updated: ${date.toLocaleDateString()}`);
    }

    return lines.join('\n');
  }

  /**
   * Show quick pick menu with options
   */
  async showMenu(): Promise<void> {
    const status = this.patternManager.getStatus();

    const items: vscode.QuickPickItem[] = [];

    if (!status.hasClaudeMd) {
      items.push({
        label: '$(add) Initialize Patterns',
        description: 'Create CLAUDE.md and .cursorrules'
      });
    }

    if (status.hasClaudeMd && !status.inSync) {
      items.push({
        label: '$(sync) Sync Pattern Files',
        description: 'Sync CLAUDE.md to .cursorrules'
      });
    }

    if (status.hasClaudeMd) {
      items.push({
        label: '$(file) Open CLAUDE.md',
        description: 'View and edit patterns'
      });
    }

    items.push({
      label: '$(cloud-download) Update Patterns',
      description: 'Download latest patterns from server'
    });

    items.push({
      label: '$(refresh) Refresh Status',
      description: 'Check pattern file status'
    });

    items.push({
      label: '$(info) Pattern Status',
      description: `${status.patternCount} modules loaded`
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'CodeBakers Options'
    });

    if (!selected) return;

    switch (selected.label) {
      case '$(add) Initialize Patterns':
        await vscode.commands.executeCommand('codebakers.initPatterns');
        break;
      case '$(sync) Sync Pattern Files':
        await vscode.commands.executeCommand('codebakers.syncPatterns');
        break;
      case '$(file) Open CLAUDE.md':
        await vscode.commands.executeCommand('codebakers.openClaudeMd');
        break;
      case '$(cloud-download) Update Patterns':
        await vscode.commands.executeCommand('codebakers.updatePatterns');
        break;
      case '$(refresh) Refresh Status':
        this.update();
        vscode.window.showInformationMessage('Pattern status refreshed');
        break;
      case '$(info) Pattern Status':
        this.showStatusInfo();
        break;
    }
  }

  /**
   * Show detailed status info
   */
  private showStatusInfo(): void {
    const status = this.patternManager.getStatus();

    const message = [
      `CLAUDE.md: ${status.hasClaudeMd ? 'Found' : 'Not found'}`,
      `.cursorrules: ${status.hasCursorRules ? 'Found' : 'Not found'}`,
      `Pattern modules: ${status.patternCount}`,
      `Files in sync: ${status.inSync ? 'Yes' : 'No'}`
    ].join(' | ');

    vscode.window.showInformationMessage(message);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.statusBarItem.dispose();
  }
}
