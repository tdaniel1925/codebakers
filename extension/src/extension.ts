/**
 * CodeBakers Extension - Pattern Management for AI Tools
 *
 * This extension manages CodeBakers patterns that work with:
 * - Claude Code (reads CLAUDE.md)
 * - Cursor (reads .cursorrules)
 * - Any AI tool that supports project-level instructions
 *
 * Features:
 * - Sync CLAUDE.md and .cursorrules
 * - Download/update patterns from server
 * - Status bar indicator
 * - Pattern file management
 */

import * as vscode from 'vscode';
import { PatternManager } from './PatternManager';
import { StatusBarManager } from './StatusBarManager';

let patternManager: PatternManager;
let statusBarManager: StatusBarManager;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeBakers: activate() called - v2.0.0 (Pattern Manager)');
  extensionContext = context;

  // Initialize managers
  patternManager = new PatternManager();
  statusBarManager = new StatusBarManager(patternManager);

  // Register commands
  registerCommands(context);

  // Create file watcher for pattern files
  const watcher = patternManager.createFileWatcher();
  watcher.onDidChange(() => statusBarManager.update());
  watcher.onDidCreate(() => statusBarManager.update());
  watcher.onDidDelete(() => statusBarManager.update());
  context.subscriptions.push(watcher);

  // Add status bar to subscriptions for cleanup
  context.subscriptions.push({
    dispose: () => statusBarManager.dispose()
  });

  // Show welcome message if no patterns
  const status = patternManager.getStatus();
  if (!status.hasClaudeMd && !status.hasCursorRules) {
    vscode.window.showInformationMessage(
      'CodeBakers: No patterns found. Initialize patterns to enable AI rule enforcement.',
      'Initialize Patterns'
    ).then(selection => {
      if (selection === 'Initialize Patterns') {
        vscode.commands.executeCommand('codebakers.initPatterns');
      }
    });
  } else if (!status.inSync) {
    vscode.window.showInformationMessage(
      'CodeBakers: Pattern files are out of sync.',
      'Sync Now'
    ).then(selection => {
      if (selection === 'Sync Now') {
        vscode.commands.executeCommand('codebakers.syncPatterns');
      }
    });
  }

  console.log('CodeBakers: Extension activated successfully');
}

function registerCommands(context: vscode.ExtensionContext) {
  // Show menu command (triggered by status bar click)
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.showMenu', () => {
      statusBarManager.showMenu();
    })
  );

  // Initialize patterns
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.initPatterns', async () => {
      const apiKey = await getApiKey();
      await patternManager.initializePatterns(apiKey || undefined);
      statusBarManager.update();
    })
  );

  // Sync pattern files
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.syncPatterns', async () => {
      await patternManager.syncPatternFiles();
      statusBarManager.update();
    })
  );

  // Update patterns from server
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.updatePatterns', async () => {
      const apiKey = await getApiKey();
      if (!apiKey) {
        vscode.window.showWarningMessage(
          'API key required to download patterns. Get one at codebakers.ai',
          'Get API Key'
        ).then(selection => {
          if (selection === 'Get API Key') {
            vscode.env.openExternal(vscode.Uri.parse('https://codebakers.ai/dashboard'));
          }
        });
        return;
      }
      await patternManager.updatePatterns(apiKey);
      statusBarManager.update();
    })
  );

  // Open CLAUDE.md
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.openClaudeMd', async () => {
      await patternManager.openClaudeMd();
    })
  );

  // Refresh status
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.refreshStatus', () => {
      statusBarManager.update();
      vscode.window.showInformationMessage('CodeBakers: Status refreshed');
    })
  );

  // Show pattern warnings
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.showWarnings', () => {
      statusBarManager.showWarnings();
    })
  );

  // Legacy command - redirect to menu
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.openChat', () => {
      vscode.window.showInformationMessage(
        'CodeBakers now works with Claude Code and Cursor directly! Your CLAUDE.md rules are automatically applied.',
        'Learn More'
      ).then(selection => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://codebakers.ai/docs/integration'));
        }
      });
    })
  );

  console.log('CodeBakers: All commands registered');
}

/**
 * Get API key from settings or prompt user
 */
async function getApiKey(): Promise<string | null> {
  // Check settings first
  const config = vscode.workspace.getConfiguration('codebakers');
  let apiKey = config.get<string>('apiKey');

  if (apiKey) {
    return apiKey;
  }

  // Check stored secret
  apiKey = await extensionContext.secrets.get('codebakers.apiKey') || null;

  if (apiKey) {
    return apiKey;
  }

  // Prompt user
  const input = await vscode.window.showInputBox({
    prompt: 'Enter your CodeBakers API key',
    placeHolder: 'cb_xxxxxxxxxxxxxxxx',
    password: true,
    ignoreFocusOut: true
  });

  if (input) {
    // Store for future use
    await extensionContext.secrets.store('codebakers.apiKey', input);
    return input;
  }

  return null;
}

export function deactivate() {
  console.log('CodeBakers: deactivate() called');
}
