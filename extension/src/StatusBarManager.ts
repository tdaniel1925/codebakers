/**
 * StatusBarManager - Manages the CodeBakers status bar indicator
 *
 * Shows:
 * - Pattern status (loaded/not loaded)
 * - Sync status (in sync/out of sync)
 * - Quick actions
 */

import * as vscode from 'vscode';
import { PatternManager, PatternStatus, PatternHealth, PatternWarning } from './PatternManager';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private patternManager: PatternManager;
  private refreshInterval: NodeJS.Timeout | null = null;
  private lastHealth: PatternHealth | null = null;
  private warningShownThisSession: boolean = false;

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

    // Check health on startup and show warnings if critical
    setTimeout(() => this.checkAndShowWarnings(), 2000);
  }

  /**
   * Update the status bar based on current pattern status
   */
  update(): void {
    const status = this.patternManager.getStatus();
    this.lastHealth = this.patternManager.checkPatternHealth();

    // Determine icon and color based on health
    const health = this.lastHealth;
    let icon: string;
    let backgroundColor: vscode.ThemeColor | undefined;

    if (health.enforceability === 'none' || health.enforceability === 'weak') {
      icon = '$(error)';
      backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (health.enforceability === 'moderate') {
      icon = '$(warning)';
      backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      icon = '$(check)';
      backgroundColor = undefined;
    }

    // Build display text
    const moduleText = status.patternCount > 0 ? ` [${status.patternCount}]` : '';
    const scoreText = ` ${health.score}%`;
    this.statusBarItem.text = `${icon} CodeBakers${moduleText}${scoreText}`;

    // Build tooltip
    this.statusBarItem.tooltip = this.buildHealthTooltip(status, health);
    this.statusBarItem.backgroundColor = backgroundColor;
  }

  /**
   * Build detailed tooltip with health info
   */
  private buildHealthTooltip(status: PatternStatus, health: PatternHealth): string {
    const severityIcons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵'
    };

    const enforcementLabels = {
      strong: '✅ Strong - AI will likely follow rules',
      moderate: '⚠️ Moderate - AI may sometimes ignore rules',
      weak: '❌ Weak - AI will likely ignore rules',
      none: '🚫 None - No patterns to enforce'
    };

    const lines = [
      `CodeBakers Pattern Health: ${health.score}%`,
      '',
      enforcementLabels[health.enforceability],
      '',
      `CLAUDE.md: ${status.hasClaudeMd ? '✓' : '✗'}`,
      `.cursorrules: ${status.hasCursorRules ? '✓' : '✗'}`,
      `Modules: ${status.patternCount}`,
      `In sync: ${status.inSync ? '✓' : '✗'}`
    ];

    if (health.warnings.length > 0) {
      lines.push('', '--- Warnings ---');
      for (const warning of health.warnings.slice(0, 3)) {
        lines.push(`${severityIcons[warning.severity]} ${warning.title}`);
      }
      if (health.warnings.length > 3) {
        lines.push(`... and ${health.warnings.length - 3} more`);
      }
    }

    lines.push('', 'Click for options');

    return lines.join('\n');
  }

  /**
   * Check health and show warnings if critical issues found
   */
  private checkAndShowWarnings(): void {
    if (this.warningShownThisSession) return;

    const health = this.patternManager.checkPatternHealth();
    const criticalWarnings = health.warnings.filter(w => w.severity === 'critical' || w.severity === 'high');

    if (criticalWarnings.length > 0) {
      this.warningShownThisSession = true;

      const firstWarning = criticalWarnings[0];
      const message = `CodeBakers: ${firstWarning.title} - ${firstWarning.message}`;

      if (firstWarning.action) {
        vscode.window.showWarningMessage(message, firstWarning.action, 'Show All Warnings')
          .then(selection => {
            if (selection === firstWarning.action && firstWarning.actionCommand) {
              vscode.commands.executeCommand(firstWarning.actionCommand);
            } else if (selection === 'Show All Warnings') {
              this.showWarnings();
            }
          });
      } else {
        vscode.window.showWarningMessage(message, 'Show All Warnings')
          .then(selection => {
            if (selection === 'Show All Warnings') {
              this.showWarnings();
            }
          });
      }
    }
  }

  /**
   * Show all warnings in a detailed panel
   */
  async showWarnings(): Promise<void> {
    const health = this.lastHealth || this.patternManager.checkPatternHealth();

    if (health.warnings.length === 0) {
      vscode.window.showInformationMessage('No pattern warnings. Your setup looks good!');
      return;
    }

    const severityIcons = {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM',
      low: '🔵 LOW'
    };

    const items: vscode.QuickPickItem[] = health.warnings.map(warning => ({
      label: `${severityIcons[warning.severity]}: ${warning.title}`,
      description: warning.action || '',
      detail: warning.message
    }));

    // Add header item
    items.unshift({
      label: `Pattern Health Score: ${health.score}%`,
      description: `Enforceability: ${health.enforceability}`,
      detail: `${health.warnings.length} issue(s) found`,
      kind: vscode.QuickPickItemKind.Separator
    } as any);

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Pattern Warnings - Select to fix',
      title: `CodeBakers Pattern Health: ${health.score}%`
    });

    if (selected && selected.description) {
      // Find the warning and execute its action
      const warning = health.warnings.find(w => w.action === selected.description);
      if (warning?.actionCommand) {
        await vscode.commands.executeCommand(warning.actionCommand);
      }
    }
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

    // Add warnings option if there are any
    const health = this.lastHealth || this.patternManager.checkPatternHealth();
    if (health.warnings.length > 0) {
      items.unshift({
        label: `$(alert) Show Warnings (${health.warnings.length})`,
        description: `Health: ${health.score}% - ${health.enforceability} enforcement`
      });
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'CodeBakers Options'
    });

    if (!selected) return;

    // Check if it's the warnings option (with dynamic count)
    if (selected.label.startsWith('$(alert) Show Warnings')) {
      await this.showWarnings();
      return;
    }

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
