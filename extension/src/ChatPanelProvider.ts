import * as vscode from 'vscode';
import { CodeBakersClient, FileOperation, CommandToRun } from './CodeBakersClient';
import { ProjectContext } from './ProjectContext';
import { FileOperations } from './FileOperations';
import { CodeValidator } from './CodeValidator';
import { ProjectStateManager } from './ProjectStateManager';
import { OnboardingWizard } from './OnboardingWizard';
import { ContextPreserver } from './ContextPreserver';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: Date;
}

interface PendingChange {
  id: string;
  operation: FileOperation;
  status: 'pending' | 'applied' | 'rejected';
}

interface PendingCommand {
  id: string;
  command: CommandToRun;
  status: 'pending' | 'running' | 'done' | 'error';
}

interface PinnedFile {
  path: string;
  name: string;
  content?: string;
  size?: number;
}

export class ChatPanelProvider {
  private static _instance: ChatPanelProvider | undefined;
  private _panel: vscode.WebviewPanel | undefined;
  private _messages: Message[] = [];
  private _conversationSummary: string = '';
  private readonly fileOps: FileOperations;
  private _abortController: AbortController | null = null;

  // Intelligent Onboarding System
  private _stateManager: ProjectStateManager | null = null;
  private _onboardingWizard: OnboardingWizard | null = null;
  private _contextPreserver: ContextPreserver | null = null;
  private _onboardingCompleted: boolean = false;

  // Separate tracking for pending operations (Claude Code style)
  private _pendingChanges: PendingChange[] = [];
  private _pendingCommands: PendingCommand[] = [];

  // Pinned files that persist across all messages (like Cursor's context files)
  private _pinnedFiles: PinnedFile[] = [];

  // Throttling for streaming updates
  private _streamBuffer: string = '';
  private _thinkingBuffer: string = '';
  private _streamThrottleTimer: NodeJS.Timeout | null = null;
  private _lastStreamUpdate: number = 0;
  private readonly STREAM_THROTTLE_MS = 50; // Update UI every 50ms max

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: CodeBakersClient,
    private readonly projectContext: ProjectContext
  ) {
    this.fileOps = new FileOperations();
    this._initializeOnboardingSystem();
  }

  private async _initializeOnboardingSystem(): Promise<void> {
    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      console.log('No workspace folder found - skipping onboarding system');
      return;
    }

    // Initialize Project State Manager
    this._stateManager = new ProjectStateManager(workspaceRoot);

    // Initialize Context Preserver with state manager
    this._contextPreserver = new ContextPreserver(this._stateManager);
    await this._contextPreserver.initialize();

    // Check if onboarding is needed
    const { needsOnboarding, config } = await this._stateManager.initialize();
    this._onboardingCompleted = !needsOnboarding;

    // If we have config, check for session recovery
    if (config && this._contextPreserver.checkRecovery('').needsRecovery) {
      console.log('Session recovery needed - context was compacted');
    }
  }

  public static getInstance(
    context: vscode.ExtensionContext,
    client: CodeBakersClient,
    projectContext: ProjectContext
  ): ChatPanelProvider {
    if (!ChatPanelProvider._instance) {
      ChatPanelProvider._instance = new ChatPanelProvider(context, client, projectContext);
    }
    return ChatPanelProvider._instance;
  }

  public show() {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'codebakers.chat',
      'CodeBakers',
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    this._panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.svg');
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'sendMessage':
          await this.sendMessage(data.message);
          break;
        case 'clearChat':
          this._messages = [];
          this._conversationSummary = '';
          this._pendingChanges = [];
          this._pendingCommands = [];
          this._updateWebview();
          break;
        case 'runTool':
          await this._executeTool(data.tool);
          break;
        case 'login':
          await this.client.login();
          break;
        case 'applyFile':
          await this._applyFileOperation(data.id);
          break;
        case 'applyAllFiles':
          await this._applyAllPendingChanges();
          break;
        case 'rejectFile':
          this._rejectFileOperation(data.id);
          break;
        case 'rejectAllFiles':
          this._rejectAllPendingChanges();
          break;
        case 'runCommand':
          await this._runCommand(data.id);
          break;
        case 'showDiff':
          await this._showDiff(data.id);
          break;
        case 'undoFile':
          await this._undoFileOperation(data.id);
          break;
        case 'undoAppliedFiles':
          await this._undoAppliedFiles(data.files);
          break;
        case 'cancelRequest':
          this._cancelCurrentRequest();
          break;
        case 'addPinnedFile':
          await this._addPinnedFile();
          break;
        case 'removePinnedFile':
          this._removePinnedFile(data.path);
          break;
        case 'clearPinnedFiles':
          this._pinnedFiles = [];
          this._updatePinnedFiles();
          break;
        case 'resetSessionStats':
          this.client.resetSessionStats();
          break;
        case 'logProjectTime':
          this._logProjectTime(data);
          break;
        case 'deploy':
          this._deployToVercel();
          break;
        case 'gitPush':
          this._pushToGitHub();
          break;
        case 'openMindMap':
          vscode.commands.executeCommand('codebakers.openMindMap');
          break;
        case 'openPreview':
          this._openPreviewInBrowser(data.port || 3000);
          break;
        case 'loadTeamNotes':
          this._loadTeamNotes();
          break;
        case 'saveTeamNotes':
          this._saveTeamNotes(data.notes);
          break;
        case 'analyzeImpact':
          this._analyzeImpact(data.message);
          break;
        case 'installPackages':
          this._installPackages(data.packages);
          break;
        case 'onboarding-action':
          this._handleOnboardingAction(data.action, data.data);
          break;
        case 'checkOnboarding':
          this._checkAndShowOnboarding();
          break;
      }
    });

    this._panel.onDidDispose(() => {
      this._panel = undefined;
    });

    this._initializeStatus();
  }

  public refresh() {
    if (this._panel) {
      this._initializeStatus();
      this._updateWebview();
    }
  }

  /**
   * Set the input field with context (e.g., from editor selection)
   * This pre-fills the chat input without sending, allowing user to add their question
   */
  public setInputWithContext(text: string) {
    if (!this._panel) {
      this.show();
    }
    // Give panel time to initialize if just created
    setTimeout(() => {
      this._panel?.webview.postMessage({
        type: 'setInputValue',
        value: text
      });
    }, 100);
  }

  private async _initializeStatus() {
    if (!this._panel) return;

    try {
      const planInfo = this.client.getPlanInfo();
      this._panel.webview.postMessage({
        type: 'updatePlan',
        plan: planInfo.plan
      });

      if (!this.client.hasSessionToken()) {
        this._panel.webview.postMessage({
          type: 'updateHealth',
          health: 0,
          score: 0
        });
        this._panel.webview.postMessage({
          type: 'showLogin'
        });
        return;
      }

      try {
        const health = await this.client.guardianStatus();
        this._panel.webview.postMessage({
          type: 'updateHealth',
          health: health.data?.health || 85,
          score: health.data?.health || 85
        });
      } catch (healthError) {
        console.warn('Health check failed:', healthError);
        this._panel.webview.postMessage({
          type: 'updateHealth',
          health: 85,
          score: 85
        });
      }

      // Check if onboarding is needed (after successful login check)
      await this._checkAndShowOnboarding();

    } catch (error) {
      console.error('Failed to initialize status:', error);
    }
  }

  private async _executeTool(toolName: string) {
    if (!this._panel) return;

    try {
      this._panel.webview.postMessage({ type: 'typing', isTyping: true });
      const result = await this.client.executeTool(toolName, {});

      // Add tool result as a message
      this._messages.push({
        role: 'assistant',
        content: `**Tool: ${toolName}**\n\`\`\`json\n${JSON.stringify(result.data || result, null, 2)}\n\`\`\``,
        timestamp: new Date()
      });

      if (toolName === 'guardian_status' && result.data?.health) {
        this._panel.webview.postMessage({
          type: 'updateHealth',
          health: result.data.health,
          score: result.data.health
        });
      }
    } catch (error) {
      this._messages.push({
        role: 'assistant',
        content: `**Tool Error: ${toolName}**\n${error instanceof Error ? error.message : 'Tool execution failed'}`,
        timestamp: new Date()
      });
    } finally {
      this._panel?.webview.postMessage({ type: 'typing', isTyping: false });
      this._updateWebview();
    }
  }

  private async _applyFileOperation(id: string) {
    if (!this._panel) return;

    const change = this._pendingChanges.find(c => c.id === id);
    if (!change || change.status !== 'pending') return;

    try {
      const success = await this.fileOps.applyChange({
        path: change.operation.path,
        action: change.operation.action,
        content: change.operation.content,
        description: change.operation.description
      });

      if (success) {
        change.status = 'applied';
        vscode.window.showInformationMessage(`✅ ${change.operation.action}: ${change.operation.path}`);
        this._updatePendingChanges();

        // Open the file if not a delete
        if (change.operation.action !== 'delete') {
          await this.fileOps.openFile(change.operation.path);
        }

        // Auto-remove after brief delay to show "applied" status
        setTimeout(() => {
          this._pendingChanges = this._pendingChanges.filter(c => c.id !== id);
          this._updatePendingChanges();
        }, 1500);
      } else {
        throw new Error('Operation failed');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed: ${change.operation.path} - ${error}`);
      this._updatePendingChanges();
    }
  }

  private async _applyAllPendingChanges() {
    if (!this._panel) return;

    const pending = this._pendingChanges.filter(c => c.status === 'pending');
    if (pending.length === 0) {
      vscode.window.showInformationMessage('No pending changes to apply');
      return;
    }

    // Show progress in webview
    const total = pending.length;
    this._panel?.webview.postMessage({
      type: 'showProgress',
      text: `Applying 0/${total} files...`,
      current: 0,
      total,
      show: true
    });

    // Apply files in parallel batches of 5 for speed
    const BATCH_SIZE = 5;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (change) => {
          try {
            const result = await this.fileOps.applyChange({
              path: change.operation.path,
              action: change.operation.action,
              content: change.operation.content,
              description: change.operation.description
            });

            if (result) {
              change.status = 'applied';
              return true;
            } else {
              return false;
            }
          } catch (error) {
            console.error(`Failed to apply ${change.operation.path}:`, error);
            return false;
          }
        })
      );

      // Count results
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          success++;
        } else {
          failed++;
        }
      });

      // Update progress indicator
      const done = success + failed;
      this._panel?.webview.postMessage({
        type: 'showProgress',
        text: `Applying ${done}/${total} files...`,
        current: done,
        total,
        show: true
      });

      // Update UI after each batch
      this._updatePendingChanges();
    }

    this._panel?.webview.postMessage({ type: 'showProgress', show: false });
    vscode.window.showInformationMessage(
      `✅ Applied ${success} file(s)${failed > 0 ? `, ${failed} failed` : ''}`
    );

    // Clear applied changes from the list (keep only rejected/failed ones)
    this._pendingChanges = this._pendingChanges.filter(c => c.status === 'rejected');
    this._updatePendingChanges();

    // Auto-run TypeScript check after applying files
    if (success > 0) {
      await this._runTscCheck();
    }
  }

  private async _runTscCheck(autoRetry: boolean = true) {
    // Check if project has TypeScript
    const tsconfigExists = await this.fileOps.fileExists('tsconfig.json');
    if (!tsconfigExists) {
      return; // No TypeScript in project
    }

    this._panel?.webview.postMessage({
      type: 'showStatus',
      text: 'Checking TypeScript...',
      show: true
    });

    try {
      const validator = new CodeValidator();
      const result = await validator.runTypeScriptCheck();

      this._panel?.webview.postMessage({ type: 'showStatus', show: false });

      if (!result.passed && result.errors.length > 0) {
        // Send ripple check visual feedback to webview
        this._panel?.webview.postMessage({
          type: 'rippleCheck',
          errors: result.errorCount,
          warnings: 0,
          details: result.errors.slice(0, 4).map((e: any) => ({
            type: 'error',
            message: `${e.file}:${e.line} - ${e.message.substring(0, 60)}${e.message.length > 60 ? '...' : ''}`
          }))
        });

        const action = await vscode.window.showWarningMessage(
          `⚠️ TypeScript errors found (${result.errorCount})`,
          'Auto-Fix with AI',
          'Show Errors',
          'Ignore'
        );

        if (action === 'Auto-Fix with AI' && autoRetry) {
          // Send errors to AI for auto-fix
          const errorMessage = `Please fix these TypeScript errors:\n\n${result.errors.map((e: any) =>
            `${e.file}:${e.line}: ${e.message}`
          ).join('\n')}`;

          this._panel?.webview.postMessage({
            type: 'showStatus',
            text: 'AI fixing TypeScript errors...',
            show: true
          });

          // Trigger a new AI request with the errors
          await this.sendMessage(errorMessage);
        } else if (action === 'Show Errors') {
          // Show errors in output channel
          const outputChannel = vscode.window.createOutputChannel('CodeBakers TSC');
          outputChannel.clear();
          outputChannel.appendLine('TypeScript Errors:');
          outputChannel.appendLine('=================\n');
          result.errors.forEach((e: any) => {
            outputChannel.appendLine(`${e.file}:${e.line}:${e.column}`);
            outputChannel.appendLine(`  ${e.message}\n`);
          });
          outputChannel.show();
        }
      } else {
        // Send success ripple check to webview
        this._panel?.webview.postMessage({
          type: 'rippleCheck',
          errors: 0,
          warnings: 0,
          details: [{ type: 'pass', message: 'TypeScript compilation successful' }]
        });
        vscode.window.showInformationMessage('✅ TypeScript check passed!');
      }
    } catch (error) {
      this._panel?.webview.postMessage({ type: 'showStatus', show: false });
      console.error('TSC check failed:', error);
    }
  }

  private _rejectFileOperation(id: string) {
    const change = this._pendingChanges.find(c => c.id === id);
    if (change && change.status === 'pending') {
      change.status = 'rejected';
      this._updatePendingChanges();
    }
  }

  private _rejectAllPendingChanges() {
    for (const change of this._pendingChanges) {
      if (change.status === 'pending') {
        change.status = 'rejected';
      }
    }
    this._updatePendingChanges();
  }

  private async _runCommand(id: string) {
    if (!this._panel) return;

    const cmd = this._pendingCommands.find(c => c.id === id);
    if (!cmd || cmd.status !== 'pending') return;

    try {
      cmd.status = 'running';
      this._updatePendingChanges();

      await this.fileOps.runCommand(cmd.command.command, cmd.command.description || 'CodeBakers');
      cmd.status = 'done';
      vscode.window.showInformationMessage(`🚀 Running: ${cmd.command.command}`);
    } catch (error) {
      cmd.status = 'pending'; // Reset to allow retry
      vscode.window.showErrorMessage(`❌ Failed to run command: ${error}`);
    }

    this._updatePendingChanges();
  }

  private async _showDiff(id: string) {
    const change = this._pendingChanges.find(c => c.id === id);
    if (!change || !change.operation.content) return;

    try {
      await this.fileOps.showDiff(
        change.operation.path,
        change.operation.content,
        `CodeBakers: ${change.operation.path}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to show diff: ${error}`);
    }
  }

  private async _undoFileOperation(id: string) {
    const change = this._pendingChanges.find(c => c.id === id);
    if (!change || change.status !== 'applied') {
      vscode.window.showWarningMessage('Cannot undo - change was not applied');
      return;
    }

    try {
      const success = await this.fileOps.restoreFromBackup(change.operation.path);
      if (success) {
        // Mark as pending again so user can re-apply if desired
        change.status = 'pending';
        this._updatePendingChanges();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to undo: ${error}`);
    }
  }

  private async _undoAppliedFiles(files: string[]) {
    if (!files || files.length === 0) return;

    let undoneCount = 0;
    for (const filePath of files) {
      try {
        const success = await this.fileOps.restoreFromBackup(filePath);
        if (success) {
          undoneCount++;
          // Remove from pending changes tracking
          this._pendingChanges = this._pendingChanges.filter(c => c.operation.path !== filePath);
        }
      } catch (error) {
        console.error(`Failed to undo ${filePath}:`, error);
      }
    }

    if (undoneCount > 0) {
      vscode.window.showInformationMessage(`↩️ Undone ${undoneCount} file${undoneCount > 1 ? 's' : ''}`);
      this._updatePendingChanges();
    }
  }

  private _cancelCurrentRequest() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
      this._panel?.webview.postMessage({ type: 'requestCancelled' });
      vscode.window.showInformationMessage('Request cancelled');
    }
  }

  /**
   * Log project time for billing purposes
   * Persists to .codebakers/timelog.json
   */
  private _logProjectTime(data: {
    activeTime: number;
    totalCost: number;
    requests: number;
    tokens: number;
    isSessionEnd?: boolean;
  }) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const fs = require('fs');
    const path = require('path');
    const rootPath = workspaceFolder.uri.fsPath;
    const codebakersDir = path.join(rootPath, '.codebakers');
    const timelogPath = path.join(codebakersDir, 'timelog.json');

    // Ensure .codebakers directory exists
    if (!fs.existsSync(codebakersDir)) {
      fs.mkdirSync(codebakersDir, { recursive: true });
    }

    // Load existing timelog
    let timelog: {
      sessions: Array<{
        date: string;
        activeMinutes: number;
        cost: number;
        requests: number;
        tokens: number;
      }>;
      totals: {
        totalMinutes: number;
        totalCost: number;
        totalRequests: number;
        totalTokens: number;
      };
    } = {
      sessions: [],
      totals: { totalMinutes: 0, totalCost: 0, totalRequests: 0, totalTokens: 0 }
    };

    if (fs.existsSync(timelogPath)) {
      try {
        timelog = JSON.parse(fs.readFileSync(timelogPath, 'utf-8'));
      } catch {
        // Use default if corrupted
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const activeMinutes = Math.round(data.activeTime / 60000);

    // Find or create today's session entry
    let todaySession = timelog.sessions.find(s => s.date === today);
    if (!todaySession) {
      todaySession = { date: today, activeMinutes: 0, cost: 0, requests: 0, tokens: 0 };
      timelog.sessions.push(todaySession);
    }

    // Update today's session (take the max values as they're cumulative)
    todaySession.activeMinutes = Math.max(todaySession.activeMinutes, activeMinutes);
    todaySession.cost = Math.max(todaySession.cost, data.totalCost);
    todaySession.requests = Math.max(todaySession.requests, data.requests);
    todaySession.tokens = Math.max(todaySession.tokens, data.tokens);

    // Recalculate totals
    timelog.totals = {
      totalMinutes: timelog.sessions.reduce((sum, s) => sum + s.activeMinutes, 0),
      totalCost: timelog.sessions.reduce((sum, s) => sum + s.cost, 0),
      totalRequests: timelog.sessions.reduce((sum, s) => sum + s.requests, 0),
      totalTokens: timelog.sessions.reduce((sum, s) => sum + s.tokens, 0)
    };

    // Keep only last 90 days of sessions
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    timelog.sessions = timelog.sessions.filter(s => new Date(s.date) >= cutoff);

    // Write updated timelog
    fs.writeFileSync(timelogPath, JSON.stringify(timelog, null, 2));
  }

  /**
   * Deploy to Vercel with one click
   */
  private async _deployToVercel() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Show progress
    this._panel?.webview.postMessage({
      type: 'showStatus',
      show: true,
      text: '🚀 Deploying to Vercel...'
    });

    // Add deploying message to chat
    this._messages.push({
      role: 'assistant',
      content: '🚀 **Starting Vercel deployment...**\n\nRunning `vercel --prod`...',
      timestamp: new Date()
    });
    this._updateWebview();

    try {
      const cp = require('child_process');
      const rootPath = workspaceFolder.uri.fsPath;

      // Run vercel --prod
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        cp.exec(
          'npx vercel --prod --yes',
          { cwd: rootPath, timeout: 300000 }, // 5 minute timeout
          (error: any, stdout: string, stderr: string) => {
            if (error && !stdout) {
              reject(error);
            } else {
              resolve({ stdout, stderr });
            }
          }
        );
      });

      // Extract deployment URL from output
      const urlMatch = result.stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
      const deployUrl = urlMatch ? urlMatch[0] : null;

      // Success message
      let successMsg = '✅ **Deployment successful!**\n\n';
      if (deployUrl) {
        successMsg += `🔗 **Live URL:** [${deployUrl}](${deployUrl})\n\n`;
      }
      successMsg += '```\n' + result.stdout.slice(-500) + '\n```';

      this._messages.push({
        role: 'assistant',
        content: successMsg,
        timestamp: new Date()
      });

      vscode.window.showInformationMessage(
        `✅ Deployed successfully!${deployUrl ? ` URL: ${deployUrl}` : ''}`,
        'Open URL'
      ).then(selection => {
        if (selection === 'Open URL' && deployUrl) {
          vscode.env.openExternal(vscode.Uri.parse(deployUrl));
        }
      });

    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';

      // Check if Vercel CLI is not installed
      if (errorMsg.includes('vercel') && errorMsg.includes('not found')) {
        this._messages.push({
          role: 'assistant',
          content: '❌ **Vercel CLI not found**\n\nPlease install it first:\n```bash\nnpm install -g vercel\n```\n\nThen run `vercel login` to authenticate.',
          timestamp: new Date()
        });
      } else {
        this._messages.push({
          role: 'assistant',
          content: `❌ **Deployment failed**\n\n\`\`\`\n${errorMsg}\n\`\`\`\n\nMake sure you have:\n1. Vercel CLI installed (\`npm i -g vercel\`)\n2. Logged in (\`vercel login\`)\n3. Project linked (\`vercel link\`)`,
          timestamp: new Date()
        });
      }

      vscode.window.showErrorMessage(`Deployment failed: ${errorMsg}`);
    } finally {
      this._panel?.webview.postMessage({ type: 'showStatus', show: false });
      this._updateWebview();
    }
  }

  /**
   * Push to GitHub with one click
   */
  private async _pushToGitHub() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const cp = require('child_process');

    // First check if this is a git repo
    try {
      await new Promise<void>((resolve, reject) => {
        cp.exec('git rev-parse --git-dir', { cwd: rootPath }, (error: any) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } catch {
      vscode.window.showErrorMessage('Not a git repository. Run `git init` first.');
      return;
    }

    // Check for uncommitted changes
    let hasChanges = false;
    try {
      const status = await new Promise<string>((resolve, reject) => {
        cp.exec('git status --porcelain', { cwd: rootPath }, (error: any, stdout: string) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      hasChanges = status.trim().length > 0;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Git error: ${error.message}`);
      return;
    }

    // If there are changes, ask for commit message
    let commitMessage = '';
    if (hasChanges) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter commit message (or leave empty to skip commit)',
        placeHolder: 'feat: add new feature',
        value: 'chore: update from CodeBakers'
      });

      if (input === undefined) {
        return; // User cancelled
      }
      commitMessage = input;
    }

    // Show progress
    this._panel?.webview.postMessage({
      type: 'showStatus',
      show: true,
      text: '📤 Pushing to GitHub...'
    });

    // Add message to chat
    this._messages.push({
      role: 'assistant',
      content: hasChanges && commitMessage
        ? `📤 **Pushing to GitHub...**\n\nCommitting changes and pushing to remote...`
        : `📤 **Pushing to GitHub...**\n\nPushing to remote...`,
      timestamp: new Date()
    });
    this._updateWebview();

    try {
      let output = '';

      // If we have changes and a commit message, stage and commit
      if (hasChanges && commitMessage) {
        // Stage all changes
        await new Promise<void>((resolve, reject) => {
          cp.exec('git add -A', { cwd: rootPath }, (error: any) => {
            if (error) reject(error);
            else resolve();
          });
        });

        // Commit
        const commitResult = await new Promise<string>((resolve, reject) => {
          cp.exec(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: rootPath }, (error: any, stdout: string) => {
            if (error && !stdout) reject(error);
            else resolve(stdout);
          });
        });
        output += commitResult + '\n';
      }

      // Push to remote
      const pushResult = await new Promise<string>((resolve, reject) => {
        cp.exec('git push', { cwd: rootPath, timeout: 60000 }, (error: any, stdout: string, stderr: string) => {
          if (error && !stdout && !stderr) reject(error);
          else resolve(stdout + stderr);
        });
      });
      output += pushResult;

      // Get the remote URL for display
      let remoteUrl = '';
      try {
        remoteUrl = await new Promise<string>((resolve) => {
          cp.exec('git remote get-url origin', { cwd: rootPath }, (_error: any, stdout: string) => {
            resolve(stdout.trim());
          });
        });
        // Convert SSH URL to HTTPS for clickable link
        if (remoteUrl.startsWith('git@github.com:')) {
          remoteUrl = remoteUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '');
        }
      } catch {
        // Ignore - remote URL is optional for display
      }

      // Success message
      let successMsg = '✅ **Pushed to GitHub successfully!**\n\n';
      if (remoteUrl && remoteUrl.includes('github.com')) {
        successMsg += `🔗 **Repository:** [${remoteUrl}](${remoteUrl})\n\n`;
      }
      if (hasChanges && commitMessage) {
        successMsg += `📝 **Commit:** ${commitMessage}\n\n`;
      }
      successMsg += '```\n' + output.slice(-300) + '\n```';

      this._messages.push({
        role: 'assistant',
        content: successMsg,
        timestamp: new Date()
      });

      vscode.window.showInformationMessage(
        `✅ Pushed to GitHub!${remoteUrl ? '' : ''}`,
        remoteUrl.includes('github.com') ? 'Open Repository' : undefined as any
      ).then(selection => {
        if (selection === 'Open Repository' && remoteUrl) {
          vscode.env.openExternal(vscode.Uri.parse(remoteUrl));
        }
      });

    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';

      // Check for common errors
      if (errorMsg.includes('no upstream') || errorMsg.includes('no tracking')) {
        this._messages.push({
          role: 'assistant',
          content: `❌ **No upstream branch set**\n\nRun this to set up tracking:\n\`\`\`bash\ngit push -u origin main\n\`\`\``,
          timestamp: new Date()
        });
      } else if (errorMsg.includes('Permission denied') || errorMsg.includes('authentication')) {
        this._messages.push({
          role: 'assistant',
          content: `❌ **Authentication failed**\n\nMake sure you have:\n1. GitHub CLI installed (\`gh auth login\`)\n2. Or SSH keys configured\n3. Or Git credentials stored`,
          timestamp: new Date()
        });
      } else {
        this._messages.push({
          role: 'assistant',
          content: `❌ **Push failed**\n\n\`\`\`\n${errorMsg}\n\`\`\``,
          timestamp: new Date()
        });
      }

      vscode.window.showErrorMessage(`Push failed: ${errorMsg}`);
    } finally {
      this._panel?.webview.postMessage({ type: 'showStatus', show: false });
      this._updateWebview();
    }
  }

  private _openPreviewInBrowser(port: number = 3000) {
    const url = `http://localhost:${port}`;
    vscode.env.openExternal(vscode.Uri.parse(url));
    vscode.window.showInformationMessage(`Opening ${url} in browser...`);
  }

  /**
   * Auto-install missing npm packages
   */
  private async _installPackages(packages: string[]) {
    if (!packages || packages.length === 0) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const cp = require('child_process');
    const packageList = packages.join(' ');

    // Show installing message
    this._panel?.webview.postMessage({
      type: 'toast',
      message: `📦 Installing: ${packageList}...`
    });

    try {
      await new Promise<void>((resolve, reject) => {
        cp.exec(
          `npm install ${packageList}`,
          { cwd: rootPath, timeout: 120000 }, // 2 minute timeout
          (error: any, stdout: string, stderr: string) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });

      // Success toast
      this._panel?.webview.postMessage({
        type: 'toast',
        message: `✅ Installed: ${packageList}`
      });

      vscode.window.showInformationMessage(`✅ Installed: ${packageList}`);

    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      this._panel?.webview.postMessage({
        type: 'toast',
        message: `❌ Install failed: ${errorMsg}`
      });
      vscode.window.showErrorMessage(`Package install failed: ${errorMsg}`);
    }
  }

  /**
   * Load team notes from .codebakers/team-notes.md
   */
  private _loadTeamNotes() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const fs = require('fs');
    const path = require('path');
    const notesPath = path.join(workspaceFolder.uri.fsPath, '.codebakers', 'team-notes.md');

    let notes = '';
    if (fs.existsSync(notesPath)) {
      try {
        notes = fs.readFileSync(notesPath, 'utf-8');
      } catch {
        // File doesn't exist yet, that's ok
      }
    }

    this._panel?.webview.postMessage({
      type: 'updateTeamNotes',
      notes
    });
  }

  /**
   * Save team notes to .codebakers/team-notes.md
   */
  private _saveTeamNotes(notes: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const fs = require('fs');
    const path = require('path');
    const codebakersDir = path.join(workspaceFolder.uri.fsPath, '.codebakers');
    const notesPath = path.join(codebakersDir, 'team-notes.md');

    // Ensure .codebakers directory exists
    if (!fs.existsSync(codebakersDir)) {
      fs.mkdirSync(codebakersDir, { recursive: true });
    }

    fs.writeFileSync(notesPath, notes);
  }

  /**
   * Analyze impact of a code-related request
   * Returns files that might be affected by the request
   */
  private async _analyzeImpact(message: string) {
    if (!this._panel) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._panel.webview.postMessage({
        type: 'impactAnalysis',
        files: [{ name: 'No workspace open', impact: 'medium' }],
        warning: 'Open a workspace folder to enable impact analysis'
      });
      return;
    }

    const fs = require('fs');
    const path = require('path');
    const messageLower = message.toLowerCase();
    const files: { name: string; impact?: string }[] = [];
    let warning = '';

    try {
      // Analyze message for keywords and find related files
      const srcPath = path.join(workspaceFolder.uri.fsPath, 'src');

      if (fs.existsSync(srcPath)) {
        // Check for API routes
        if (messageLower.includes('api') || messageLower.includes('endpoint') || messageLower.includes('route')) {
          const apiPath = path.join(srcPath, 'app', 'api');
          if (fs.existsSync(apiPath)) {
            files.push({ name: 'src/app/api/', impact: 'high' });
          }
        }

        // Check for components
        if (messageLower.includes('component') || messageLower.includes('button') || messageLower.includes('form') || messageLower.includes('modal')) {
          const componentsPath = path.join(srcPath, 'components');
          if (fs.existsSync(componentsPath)) {
            files.push({ name: 'src/components/', impact: 'medium' });
          }
        }

        // Check for pages
        if (messageLower.includes('page') || messageLower.includes('layout')) {
          const appPath = path.join(srcPath, 'app');
          if (fs.existsSync(appPath)) {
            files.push({ name: 'src/app/', impact: 'high' });
          }
        }

        // Check for database/schema
        if (messageLower.includes('database') || messageLower.includes('schema') || messageLower.includes('table') || messageLower.includes('model')) {
          const schemaPath = path.join(srcPath, 'lib', 'db', 'schema.ts');
          if (fs.existsSync(schemaPath)) {
            files.push({ name: 'src/lib/db/schema.ts', impact: 'high' });
            warning = 'Database schema changes may require migrations';
          }
        }

        // Check for auth
        if (messageLower.includes('auth') || messageLower.includes('login') || messageLower.includes('session')) {
          const authPath = path.join(srcPath, 'lib', 'auth.ts');
          if (fs.existsSync(authPath)) {
            files.push({ name: 'src/lib/auth.ts', impact: 'high' });
            warning = 'Authentication changes require careful security review';
          }
        }

        // Check for styles
        if (messageLower.includes('style') || messageLower.includes('css') || messageLower.includes('theme')) {
          files.push({ name: '*.css / globals.css', impact: 'medium' });
        }
      }

      // Default if no specific files found
      if (files.length === 0) {
        files.push({ name: 'src/', impact: 'medium' });
      }

    } catch (error) {
      console.error('Impact analysis error:', error);
      files.push({ name: 'Analysis unavailable' });
    }

    this._panel.webview.postMessage({
      type: 'impactAnalysis',
      files,
      warning
    });
  }

  /**
   * Show a toast notification for applied files with undo option
   */
  private _showAppliedToast(appliedFiles: string[]) {
    const count = appliedFiles.length;
    const fileNames = appliedFiles.map(f => f.split('/').pop()).join(', ');

    // Send toast to webview
    this._panel?.webview.postMessage({
      type: 'toast',
      message: `Applied ${count} file${count > 1 ? 's' : ''}: ${fileNames}`,
      action: 'undo',
      files: appliedFiles
    });

    // Also run TypeScript check after applying
    this._runTscCheck();
  }

  // Pinned files management (Cursor-style context files)
  private async _addPinnedFile() {
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFolders: false,
      openLabel: 'Add to Context',
      filters: {
        'Code Files': ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'html', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h'],
        'All Files': ['*']
      }
    });

    if (!files || files.length === 0) return;

    for (const file of files) {
      const relativePath = vscode.workspace.asRelativePath(file);

      // Skip if already pinned
      if (this._pinnedFiles.some(f => f.path === relativePath)) {
        continue;
      }

      try {
        const content = await this.fileOps.readFile(relativePath);
        const stats = await vscode.workspace.fs.stat(file);

        this._pinnedFiles.push({
          path: relativePath,
          name: relativePath.split('/').pop() || relativePath,
          content: content || '',
          size: stats.size
        });
      } catch (error) {
        console.error(`Failed to read file ${relativePath}:`, error);
        vscode.window.showWarningMessage(`Could not read: ${relativePath}`);
      }
    }

    this._updatePinnedFiles();
    vscode.window.showInformationMessage(`📎 Added ${files.length} file(s) to context`);
  }

  private _removePinnedFile(path: string) {
    this._pinnedFiles = this._pinnedFiles.filter(f => f.path !== path);
    this._updatePinnedFiles();
  }

  private _updatePinnedFiles() {
    if (!this._panel) return;

    this._panel.webview.postMessage({
      type: 'updatePinnedFiles',
      files: this._pinnedFiles.map(f => ({
        path: f.path,
        name: f.name,
        size: f.size
      }))
    });
  }

  private _getPinnedFilesContext(): string {
    if (this._pinnedFiles.length === 0) return '';

    let context = '\n\n---\n## Pinned Context Files\n\n';
    for (const file of this._pinnedFiles) {
      context += `### ${file.path}\n\`\`\`\n${file.content || '(empty)'}\n\`\`\`\n\n`;
    }
    return context;
  }

  // Filter stream content to remove code - code goes to files, not chat
  private _filterStreamContent(content: string): string {
    if (!content) return '';

    let text = content;

    // Remove file_operation XML blocks (these contain code being written to files)
    while (text.includes('<file_operation>')) {
      const start = text.indexOf('<file_operation>');
      const end = text.indexOf('</file_operation>', start);
      if (end === -1) break;
      text = text.substring(0, start) + text.substring(end + 17);
    }

    // Remove markdown code blocks (triple backticks) - the code is going to files
    while (text.includes('```')) {
      const start = text.indexOf('```');
      const end = text.indexOf('```', start + 3);
      if (end === -1) break;
      text = text.substring(0, start) + text.substring(end + 3);
    }

    // Remove other internal XML tags
    const tagsToRemove = ['content', 'action', 'path', 'thinking', 'result'];
    for (const tag of tagsToRemove) {
      text = text.split(`<${tag}>`).join('').split(`</${tag}>`).join('');
    }

    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    // If after filtering there's very little content, show a status message
    if (text.length < 20) {
      return '✨ Generating code...';
    }

    return text;
  }

  // Throttled streaming update
  private _throttledStreamUpdate() {
    const now = Date.now();

    if (now - this._lastStreamUpdate < this.STREAM_THROTTLE_MS) {
      // Schedule update if not already scheduled
      if (!this._streamThrottleTimer) {
        this._streamThrottleTimer = setTimeout(() => {
          this._streamThrottleTimer = null;
          this._sendStreamUpdate();
        }, this.STREAM_THROTTLE_MS);
      }
      return;
    }

    this._sendStreamUpdate();
  }

  private _sendStreamUpdate() {
    this._lastStreamUpdate = Date.now();

    if (this._thinkingBuffer) {
      this._panel?.webview.postMessage({
        type: 'streamThinking',
        thinking: this._thinkingBuffer
      });
    }

    if (this._streamBuffer) {
      this._panel?.webview.postMessage({
        type: 'streamContent',
        content: this._streamBuffer
      });
    }
  }

  async sendMessage(userMessage: string) {
    if (!this._panel) return;

    // Check if user is logged in
    if (!this.client.hasSessionToken()) {
      this._panel.webview.postMessage({ type: 'showLogin' });
      vscode.window.showWarningMessage(
        'Please sign in to CodeBakers first',
        'Sign In with GitHub'
      ).then(selection => {
        if (selection === 'Sign In with GitHub') {
          this.client.login();
        }
      });
      return;
    }

    this._messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    this._updateWebview();

    // Reset stream buffers
    this._streamBuffer = '';
    this._thinkingBuffer = '';

    try {
      this._abortController = new AbortController();
      this._panel.webview.postMessage({ type: 'typing', isTyping: true });

      const projectState = await this.projectContext.getProjectState();
      const contextualizedMessages = await this._buildContextualizedMessages(userMessage, projectState);

      const response = await this.client.chat(contextualizedMessages, projectState, {
        onThinking: (thinking) => {
          this._thinkingBuffer = thinking;
          this._throttledStreamUpdate();
        },
        onContent: (content) => {
          // Filter out code/file operations from stream - they go to files, not chat
          this._streamBuffer = this._filterStreamContent(content);
          this._throttledStreamUpdate();
        },
        onDone: () => {
          this._panel?.webview.postMessage({ type: 'validating' });
        },
        onError: (error) => {
          this._panel?.webview.postMessage({
            type: 'streamError',
            error: error.message
          });
        },
        abortSignal: this._abortController.signal
      });

      // Add assistant message (content only, no file ops embedded)
      this._messages.push({
        role: 'assistant',
        content: response.content,
        thinking: response.thinking,
        timestamp: new Date()
      });

      // Send usage stats to webview for cost tracking
      if (response.usage) {
        this._panel?.webview.postMessage({
          type: 'updateSessionStats',
          usage: response.usage
        });
      }

      // ABSOLUTE ENFORCEMENT: Check Gate 2 compliance before applying files
      if (response.fileOperations && response.fileOperations.length > 0) {
        const gate2Passed = response.gate2?.passed ?? true;
        const complianceScore = response.gate2?.compliance?.score ?? 100;
        const MINIMUM_COMPLIANCE_SCORE = 60; // Threshold for auto-apply

        // Only auto-apply if Gate 2 passed AND compliance score is acceptable
        if (gate2Passed && complianceScore >= MINIMUM_COMPLIANCE_SCORE) {
          const appliedFiles: string[] = [];
          for (const op of response.fileOperations) {
            try {
              const result = await this.fileOps.applyChange({
                path: op.path,
                action: op.action,
                content: op.content,
                description: op.description
              });
              if (result) {
                appliedFiles.push(op.path);
                // Track for potential undo
                this._pendingChanges.push({
                  id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                  operation: op,
                  status: 'applied'
                });
              }
            } catch (error) {
              console.error(`Failed to apply ${op.path}:`, error);
            }
          }
          // Show toast notification
          if (appliedFiles.length > 0) {
            this._showAppliedToast(appliedFiles);
          }
        } else {
          // ENFORCEMENT BLOCKED: Add files to pending instead of auto-applying
          const issues = response.gate2?.issues || ['Compliance validation failed'];

          vscode.window.showWarningMessage(
            `⛔ CodeBakers Enforcement: Files blocked (Score: ${complianceScore}/100). Issues: ${issues.join(', ')}`,
            'Apply Anyway',
            'View Issues'
          ).then(async (choice) => {
            if (choice === 'Apply Anyway') {
              // User override - apply files
              for (const change of this._pendingChanges.filter(c => c.status === 'pending')) {
                try {
                  await this.fileOps.applyChange({
                    path: change.operation.path,
                    action: change.operation.action,
                    content: change.operation.content,
                    description: change.operation.description
                  });
                  change.status = 'applied';
                } catch (error) {
                  console.error(`Failed to apply ${change.operation.path}:`, error);
                }
              }
              this._updatePendingChanges();
              vscode.window.showInformationMessage('✅ Files applied (enforcement overridden)');
            } else if (choice === 'View Issues') {
              // Show detailed issues
              const detail = [
                `**Compliance Score:** ${complianceScore}/100`,
                `**Issues:**`,
                ...issues.map(i => `- ${i}`),
                '',
                `**Deductions:**`,
                ...(response.gate2?.compliance?.deductions || []).map(d => `- ${d.issue} (-${d.points} points)`)
              ].join('\n');
              vscode.window.showInformationMessage(detail, { modal: true });
            }
          });

          // Add files to pending (not auto-applied)
          for (const op of response.fileOperations) {
            this._pendingChanges.push({
              id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              operation: op,
              status: 'pending'
            });
          }
          this._updatePendingChanges();

          console.warn('CodeBakers: Files BLOCKED by enforcement. Score:', complianceScore, 'Issues:', issues);
        }
      }

      // Handle commands - auto-run only if Gate 2 passed
      if (response.commands && response.commands.length > 0) {
        const requireApproval = vscode.workspace.getConfiguration('codebakers').get('requireApproval', false);
        const gate2Passed = response.gate2?.passed ?? true;
        const complianceScore = response.gate2?.compliance?.score ?? 100;
        const MINIMUM_COMPLIANCE_SCORE = 60;

        // Block commands if Gate 2 failed
        const enforcementPassed = gate2Passed && complianceScore >= MINIMUM_COMPLIANCE_SCORE;

        for (const cmd of response.commands) {
          const cmdId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

          if (requireApproval || !enforcementPassed) {
            // Add to pending for manual approval (or enforcement blocked)
            this._pendingCommands.push({
              id: cmdId,
              command: cmd,
              status: 'pending'
            });
          } else {
            // Auto-run command immediately
            try {
              this._pendingCommands.push({
                id: cmdId,
                command: cmd,
                status: 'running'
              });
              await this.fileOps.runCommand(cmd.command, cmd.description || 'CodeBakers');
              const pendingCmd = this._pendingCommands.find(c => c.id === cmdId);
              if (pendingCmd) pendingCmd.status = 'done';
              vscode.window.showInformationMessage(`✅ Ran: ${cmd.command}`);
            } catch (error) {
              const pendingCmd = this._pendingCommands.find(c => c.id === cmdId);
              if (pendingCmd) pendingCmd.status = 'error';
              console.error(`Failed to run command ${cmd.command}:`, error);
              vscode.window.showErrorMessage(`❌ Failed: ${cmd.command}`);
            }
          }
        }

        // Update UI to show pending commands if enforcement blocked
        if (!enforcementPassed) {
          this._updatePendingChanges();
        }
      }

      if (response.projectUpdates) {
        await this.projectContext.applyUpdates(response.projectUpdates);
      }

      // Learn from the response and user message for AI memory
      await this.projectContext.learnFromResponse(response.content, userMessage);

      if (this._messages.length > 20) {
        await this._summarizeConversation();
      }
    } catch (error) {
      if ((error as Error).message !== 'Request was cancelled') {
        this._messages.push({
          role: 'assistant',
          content: `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
      }
    } finally {
      // Clear throttle timer
      if (this._streamThrottleTimer) {
        clearTimeout(this._streamThrottleTimer);
        this._streamThrottleTimer = null;
      }

      this._abortController = null;
      this._panel?.webview.postMessage({ type: 'typing', isTyping: false });
      this._updateWebview();
    }
  }

  private async _buildContextualizedMessages(userMessage: string, projectState: any): Promise<any[]> {
    const messages: any[] = [];

    // Pattern enforcement for code requests
    if (this._isCodeRequest(userMessage)) {
      messages.push({
        role: 'system',
        content: `CODEBAKERS PATTERN ENFORCEMENT:

Before writing ANY code, you MUST:
1. Check for pattern files in .claude/ directory
2. Read and follow the patterns exactly
3. Use existing code patterns from the codebase
4. Write tests for any new functionality

After writing code, you MUST:
1. Run TypeScript check (tsc --noEmit)
2. Run tests (npm test)
3. Show the CodeBakers footer: "CodeBakers | Snippets: X | TSC: ✅ | Tests: ✅"

This is STRUCTURAL enforcement - do not skip these steps.`
      });
    }

    if (this._conversationSummary) {
      messages.push({
        role: 'system',
        content: `Previous conversation summary:\n${this._conversationSummary}`
      });
    }

    if (projectState) {
      messages.push({
        role: 'system',
        content: `Current project state:\n${JSON.stringify(projectState, null, 2)}`
      });
    }

    // Include pinned files context (always available to AI)
    const pinnedContext = this._getPinnedFilesContext();
    if (pinnedContext) {
      messages.push({
        role: 'system',
        content: `The user has pinned the following files for context. These files should be referenced when relevant:${pinnedContext}`
      });
    }

    // Include AI Project Memory (learned from previous sessions)
    if (projectState?.aiMemory) {
      const memoryPrompt = this.projectContext.formatMemoryForPrompt(projectState.aiMemory);
      if (memoryPrompt) {
        messages.push({
          role: 'system',
          content: memoryPrompt
        });
      }
    }

    const recentMessages = this._messages.slice(-10);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    return messages;
  }

  private _isCodeRequest(message: string): boolean {
    if (!message) return false;

    const codeKeywords = [
      'add', 'create', 'build', 'implement', 'fix', 'update', 'change',
      'modify', 'write', 'edit', 'refactor', 'delete', 'remove',
      'feature', 'component', 'page', 'api', 'route', 'function',
      'button', 'form', 'modal', 'table', 'chart', 'endpoint'
    ];

    const messageLower = message.toLowerCase();
    return codeKeywords.some(keyword => messageLower.includes(keyword));
  }

  private async _summarizeConversation() {
    const oldMessages = this._messages.slice(0, -10);
    if (oldMessages.length === 0) return;

    const summaryPrompt = `Summarize these conversation messages, keeping key decisions and context:\n${
      oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')
    }`;

    try {
      const summary = await this.client.summarize(summaryPrompt);
      this._conversationSummary = summary;
      this._messages = this._messages.slice(-10);
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
    }
  }

  private _updateWebview() {
    if (!this._panel) return;

    this._panel.webview.postMessage({
      type: 'updateMessages',
      messages: this._messages.map(m => ({
        role: m.role,
        content: m.content,
        thinking: m.thinking,
        timestamp: m.timestamp.toISOString()
      }))
    });

    this._updatePendingChanges();
  }

  private _updatePendingChanges() {
    if (!this._panel) return;

    const pendingFileChanges = this._pendingChanges.filter(c => c.status === 'pending');
    const pendingCmds = this._pendingCommands.filter(c => c.status === 'pending');

    this._panel.webview.postMessage({
      type: 'updatePendingChanges',
      changes: this._pendingChanges.map(c => ({
        id: c.id,
        path: c.operation.path,
        action: c.operation.action,
        description: c.operation.description,
        status: c.status,
        hasContent: !!c.operation.content
      })),
      commands: this._pendingCommands.map(c => ({
        id: c.id,
        command: c.command.command,
        description: c.command.description,
        status: c.status
      })),
      pendingCount: pendingFileChanges.length + pendingCmds.length
    });
  }

  // =========================================================================
  // Intelligent Onboarding System
  // =========================================================================

  private async _checkAndShowOnboarding(): Promise<void> {
    if (!this._panel || !this._stateManager) return;

    const { needsOnboarding } = await this._stateManager.initialize();

    if (needsOnboarding) {
      // Initialize onboarding wizard
      this._onboardingWizard = new OnboardingWizard(
        this._stateManager,
        (message) => this._panel?.webview.postMessage(message)
      );

      await this._onboardingWizard.initialize();

      // Show onboarding in webview
      this._panel.webview.postMessage({
        type: 'showOnboarding',
        show: true
      });
    } else {
      this._onboardingCompleted = true;
      this._panel.webview.postMessage({
        type: 'showOnboarding',
        show: false
      });
    }
  }

  private _handleOnboardingAction(action: string, data: any): void {
    if (!this._onboardingWizard) {
      // Initialize wizard if not already done
      if (this._stateManager) {
        this._onboardingWizard = new OnboardingWizard(
          this._stateManager,
          (message) => this._panel?.webview.postMessage(message)
        );
      }
    }

    if (this._onboardingWizard) {
      this._onboardingWizard.handleInput(action, data);

      // Check if onboarding is complete
      if (!this._onboardingWizard.isOnboardingRequired()) {
        this._onboardingCompleted = true;
        this._panel?.webview.postMessage({
          type: 'showOnboarding',
          show: false
        });

        // Record work session start
        if (this._stateManager) {
          const config = this._stateManager.loadConfig();
          if (config?.discovery?.projectDescription) {
            this._stateManager.startWorkSession(
              'Project Setup',
              `Onboarding completed for ${config.projectType} project`
            );
          }
        }
      }
    }
  }

  /**
   * Get context to inject into AI messages for session continuity
   */
  private _getContextForMessage(): string {
    if (!this._contextPreserver) return '';
    return this._contextPreserver.getContextForInjection();
  }

  /**
   * Record an action for context preservation
   */
  private _recordAction(action: string): void {
    this._contextPreserver?.recordAction(action);
  }

  /**
   * Check if we need to block chat until onboarding is complete
   * Option D: No blocking - users start with welcome screen and we detect preferences from conversation
   */
  private _shouldBlockChat(): boolean {
    return false; // Option D: Welcome screen only, no blocking wizard
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .header-icon {
      width: 20px;
      height: 20px;
    }

    .header-title {
      font-weight: 600;
      font-size: 13px;
      flex: 1;
    }

    .header-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      opacity: 0.7;
    }

    .header-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      opacity: 1;
    }

    .plan-badge {
      font-size: 10px;
      padding: 2px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 10px;
    }

    .plan-badge.trial {
      background: #f0a030;
    }

    /* View Mode Toggle Buttons */
    .view-mode-toggle {
      display: flex;
      gap: 2px;
      background: var(--vscode-input-background, #3c3c3c);
      border-radius: 6px;
      padding: 2px;
      margin-left: auto;
    }

    /* View mode buttons - HIDDEN (Canvas Mode removed) */
    .view-mode-btn {
      display: none !important;
    }

    .view-mode-toggle {
      display: none !important;
    }

    /* Preview panel - HIDDEN (Canvas Mode removed) */
    .preview-panel {
      display: none !important;
    }

    /* Team Notes - HIDDEN (UI cleanup) */
    .team-notes {
      display: none !important;
    }

    /* Action Bar - HIDDEN (UI cleanup - actions in welcome screen) */
    .action-bar {
      display: none !important;
    }

    /* Add Files Hint - HIDDEN (context files in pinned section) */
    .add-files-hint {
      display: none !important;
    }

    /* Session Stats - HIDDEN (cleaner UI like Cursor) */
    .session-stats {
      display: none !important;
    }

    /* Pending Badge */
    .pending-badge {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #fff);
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      animation: pendingPulse 2s ease-in-out infinite;
    }

    .pending-badge.visible {
      display: flex;
    }

    .pending-badge:hover {
      background: var(--vscode-button-background, #0e639c);
    }

    .pending-badge .badge-icon {
      font-size: 12px;
    }

    .pending-badge .badge-count {
      min-width: 16px;
      text-align: center;
    }

    @keyframes pendingPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    /* Slide-out Pending Panel */
    .pending-slideout {
      position: fixed;
      top: 0;
      right: -320px;
      width: 300px;
      height: 100%;
      background: var(--vscode-sideBar-background, #252526);
      border-left: 1px solid var(--vscode-panel-border, #3c3c3c);
      z-index: 1000;
      transition: right 0.3s ease;
      display: flex;
      flex-direction: column;
    }

    .pending-slideout.open {
      right: 0;
    }

    .pending-slideout-header {
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .pending-slideout-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pending-slideout-close {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      opacity: 0.7;
    }

    .pending-slideout-close:hover {
      opacity: 1;
    }

    .pending-slideout-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .pending-slideout-actions {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
      display: flex;
      gap: 8px;
    }

    .pending-slideout-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .pending-slideout-btn.accept {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }

    .pending-slideout-btn.accept:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    .pending-slideout-btn.reject {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }

    .pending-slideout-btn.reject:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    .pending-file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-list-hoverBackground, #2a2d2e);
      border-radius: 6px;
      margin-bottom: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .pending-file-item:hover {
      background: var(--vscode-list-activeSelectionBackground, #094771);
    }

    .pending-file-item .file-icon {
      opacity: 0.7;
    }

    .pending-file-item .file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pending-file-item .file-action {
      font-size: 10px;
      padding: 2px 6px;
      background: var(--vscode-badge-background, #4d4d4d);
      border-radius: 4px;
      text-transform: uppercase;
    }

    .pending-history {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .pending-history-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground, #888);
      margin-bottom: 8px;
    }

    .pending-history-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
    }

    .pending-history-item .check {
      color: #4ec9b0;
    }

    /* Slideout overlay */
    .slideout-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .slideout-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* ============================================
       Canvas Mode - Pure Visualization Only
       30% Chat / 70% Canvas Split Layout
       ============================================ */

    .canvas-mode .split-container {
      flex-direction: row;
    }

    /* 30% Chat panel in Canvas Mode */
    .canvas-mode .main-content {
      display: flex !important;
      flex: 0 0 30% !important;
      max-width: 30% !important;
      border-right: 1px solid var(--vscode-panel-border, #2d2d2d);
    }

    /* 70% Canvas panel */
    .canvas-mode .preview-panel {
      display: flex !important;
      flex: 0 0 70% !important;
      max-width: 70% !important;
      width: 70% !important;
      border-left: none !important;
    }

    .canvas-mode .preview-header {
      display: none;
    }

    .canvas-mode .preview-canvas {
      border-radius: 0;
    }

    /* Hide clutter in Canvas Mode - keep it minimal */
    .canvas-mode .suggestions-panel,
    .canvas-mode .templates-gallery,
    .canvas-mode .canvas-chat-input,
    .canvas-mode .ai-response-bar,
    .canvas-mode .pinned-files,
    .canvas-mode .team-notes,
    .canvas-mode .add-files-hint,
    .canvas-mode .action-bar,
    .canvas-mode .building-overlay,
    .canvas-mode .canvas-stats {
      display: none !important;
    }

    /* AI Response Bar - only used in Classic Mode now */
    .ai-response-bar {
      display: none;
    }

    .ai-response-bar.collapsed {
      max-height: 44px;
    }

    .ai-response-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      cursor: pointer;
      min-height: 44px;
      transition: background 0.2s ease;
    }

    .ai-response-header:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .ai-response-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ai-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
      animation: pulse-dot 2s infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .ai-response-status {
      font-size: 13px;
      font-weight: 600;
      color: #4ade80;
      letter-spacing: 0.3px;
    }

    .ai-response-summary {
      flex: 1;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ai-response-toggle {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      transition: transform 0.2s ease, color 0.2s ease;
    }

    .ai-response-toggle:hover {
      color: rgba(255, 255, 255, 0.7);
    }

    .ai-response-bar.collapsed .ai-response-toggle {
      transform: rotate(180deg);
    }

    .ai-response-content {
      padding: 0 20px 16px;
      overflow-y: auto;
      flex: 1;
      font-size: 13px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.8);
    }

    .ai-response-bar.collapsed .ai-response-content {
      display: none;
    }

    /* Canvas Mode Chat Input - Modern Design */
    .canvas-chat-input {
      display: none;
      padding: 16px 20px 20px;
      background: linear-gradient(180deg, rgba(28, 28, 30, 0.98) 0%, rgba(22, 22, 24, 1) 100%);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .canvas-mode .canvas-chat-input {
      display: none; /* Hide duplicate input - use main chat input */
    }

    .canvas-input-context {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      min-height: 24px;
    }

    .canvas-input-context.has-context {
      margin-bottom: 12px;
    }

    .context-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 8px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 20px;
      font-size: 12px;
      color: #60a5fa;
    }

    .context-icon {
      font-size: 12px;
    }

    .context-name {
      font-weight: 500;
    }

    .context-clear {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
      cursor: pointer;
      padding: 0 2px;
      margin-left: 2px;
      line-height: 1;
      transition: color 0.2s ease;
    }

    .context-clear:hover {
      color: #f87171;
    }

    .canvas-input-row {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 14px;
    }

    .canvas-input-field,
    #canvasInput {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #e5e5e5;
      font-size: 14px;
      resize: none;
      font-family: inherit;
      line-height: 1.5;
      min-height: 44px;
      max-height: 120px;
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    }

    .canvas-input-field::placeholder,
    #canvasInput::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }

    .canvas-input-field:focus,
    #canvasInput:focus {
      outline: none;
      border-color: rgba(59, 130, 246, 0.5);
      background: rgba(255, 255, 255, 0.07);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .canvas-voice-btn {
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas-voice-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
    }

    .canvas-send-btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      min-width: 80px;
    }

    .canvas-send-btn:hover {
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }

    .canvas-send-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
    }

    .canvas-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* Canvas Quick Actions - Modern Pill Buttons */
    .canvas-quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .canvas-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .canvas-action:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      color: #fff;
      transform: translateY(-1px);
    }

    .canvas-action:active {
      transform: translateY(0);
    }

    .canvas-action[data-action="explain"] {
      background: rgba(250, 204, 21, 0.08);
      border-color: rgba(250, 204, 21, 0.2);
      color: #fcd34d;
    }

    .canvas-action[data-action="explain"]:hover {
      background: rgba(250, 204, 21, 0.15);
      border-color: rgba(250, 204, 21, 0.3);
    }

    .canvas-action[data-action="add-feature"] {
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }

    .canvas-action[data-action="add-feature"]:hover {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.3);
    }

    .canvas-action[data-action="connect"] {
      background: rgba(168, 85, 247, 0.08);
      border-color: rgba(168, 85, 247, 0.2);
      color: #c084fc;
    }

    .canvas-action[data-action="connect"]:hover {
      background: rgba(168, 85, 247, 0.15);
      border-color: rgba(168, 85, 247, 0.3);
    }

    .canvas-action[data-action="generate"] {
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }

    .canvas-action[data-action="generate"]:hover {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
    }

    /* Node Selection State */
    .preview-node.selected {
      box-shadow: 0 0 0 3px var(--vscode-focusBorder, #007acc), 0 4px 12px rgba(0, 0, 0, 0.4);
      transform: translateY(-2px) scale(1.02);
    }

    .preview-node .node-actions {
      display: none;
      position: absolute;
      bottom: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-radius: 4px;
      padding: 4px;
      gap: 2px;
      z-index: 10;
    }

    .preview-node.selected .node-actions,
    .preview-node:hover .node-actions {
      display: flex;
    }

    .node-action-btn {
      padding: 4px 8px;
      background: transparent;
      border: none;
      border-radius: 3px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0.8;
    }

    .node-action-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, #5a5d5e);
      opacity: 1;
    }

    /* Session stats bar */
    .session-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 12px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .session-stats .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .session-stats .stat-label {
      opacity: 0.7;
    }

    .session-stats .stat-value {
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .session-stats .stat-value.cost {
      color: #4ec9b0;
    }

    .session-stats .reset-btn {
      margin-left: auto;
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
    }

    .session-stats .reset-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-foreground);
    }

    /* ============================================
       Pre-Flight Impact Check UI
       ============================================ */
    .impact-check {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      font-size: 12px;
    }

    .impact-check-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #60a5fa;
      margin-bottom: 10px;
    }

    .impact-check-section {
      margin-bottom: 10px;
    }

    .impact-check-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .impact-check-files {
      padding-left: 12px;
      border-left: 2px solid rgba(59, 130, 246, 0.3);
    }

    .impact-file {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }

    .impact-file.new { color: #22c55e; }
    .impact-file.modify { color: #f59e0b; }
    .impact-file.depends { color: #a78bfa; }

    .impact-warning {
      background: rgba(245, 158, 11, 0.1);
      border-left: 3px solid #f59e0b;
      padding: 8px;
      margin-top: 8px;
      border-radius: 0 4px 4px 0;
      color: #fbbf24;
      font-size: 11px;
    }

    /* ============================================
       Ripple Check / Coherence Check UI
       ============================================ */
    .ripple-check {
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      font-size: 12px;
    }

    .ripple-check.error {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .ripple-check-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #4ade80;
      margin-bottom: 8px;
    }

    .ripple-check.error .ripple-check-header {
      color: #f87171;
    }

    .ripple-check-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 11px;
    }

    .ripple-check-item .status {
      width: 16px;
      text-align: center;
    }

    .ripple-check-item.pass { color: #4ade80; }
    .ripple-check-item.fail { color: #f87171; }
    .ripple-check-item.warn { color: #fbbf24; }

    /* ============================================
       Collapsible Code Blocks
       ============================================ */
    .code-block-wrapper {
      margin: 8px 0;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--vscode-editor-background, #1e1e1e);
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .code-block-header:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    .code-block-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .code-block-filename {
      font-family: var(--vscode-editor-font-family, monospace);
      color: #60a5fa;
    }

    .code-block-lines {
      color: var(--vscode-descriptionForeground);
    }

    .code-chevron {
      transition: transform 0.2s ease;
      color: var(--vscode-descriptionForeground);
    }

    .code-block-wrapper:not(.collapsed) .code-chevron {
      transform: rotate(90deg);
    }

    .code-block-content {
      max-height: 400px;
      overflow: auto;
      transition: max-height 0.2s ease;
    }

    .code-block-wrapper.collapsed .code-block-content {
      display: none;
    }

    .code-block-content pre {
      margin: 0;
      padding: 12px;
      background: var(--vscode-editor-background, #1e1e1e);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
    }

    .code-block-content code {
      font-family: var(--vscode-editor-font-family, monospace);
    }

    /* Pre-Flight Impact Check Panel */
    .preflight-panel {
      display: none;
      margin: 12px 0;
      padding: 16px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      animation: slideIn 0.3s ease;
    }

    .preflight-panel.show {
      display: block;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .preflight-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .preflight-header svg {
      color: #3b82f6;
    }

    .preflight-section {
      margin-bottom: 12px;
    }

    .preflight-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }

    .preflight-files {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .preflight-file {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .preflight-file.high-impact {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }

    .preflight-file.medium-impact {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #f59e0b;
    }

    .preflight-warning {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      font-size: 12px;
      color: #f59e0b;
    }

    .preflight-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .preflight-btn {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .preflight-btn.primary {
      background: #3b82f6;
      color: white;
      border: none;
    }

    .preflight-btn.primary:hover {
      background: #2563eb;
    }

    .preflight-btn.secondary {
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
    }

    .preflight-btn.secondary:hover {
      background: var(--vscode-list-hoverBackground);
    }

    /* Ripple Check Panel */
    .ripple-panel {
      margin: 12px 0;
      padding: 12px 16px;
      border-radius: 8px;
      animation: slideIn 0.3s ease;
    }

    .ripple-panel.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .ripple-panel.warning {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .ripple-panel.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .ripple-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 13px;
    }

    .ripple-panel.success .ripple-header {
      color: #22c55e;
    }

    .ripple-panel.warning .ripple-header {
      color: #f59e0b;
    }

    .ripple-panel.error .ripple-header {
      color: #ef4444;
    }

    .ripple-details {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .ripple-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
    }

    .ripple-item.pass {
      color: #22c55e;
    }

    .ripple-item.fail {
      color: #ef4444;
    }

    /* Toast Notification */
    .toast-container {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #1e1e1e;
      border: 1px solid rgba(34, 197, 94, 0.4);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: toastSlideIn 0.3s ease;
      pointer-events: auto;
    }

    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .toast.hiding {
      animation: toastSlideOut 0.3s ease forwards;
    }

    @keyframes toastSlideOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(20px); }
    }

    .toast-icon {
      color: #22c55e;
    }

    .toast-message {
      flex: 1;
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .toast-undo {
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--vscode-button-border, #3c3c3c);
      border-radius: 4px;
      color: var(--vscode-foreground);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .toast-undo:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Main content area */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* Messages area */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 90%;
      padding: 12px 16px;
      border-radius: 10px;
      line-height: 1.6;
      font-size: 13px;
    }

    .message p {
      margin: 0 0 10px 0;
    }

    .message p:last-child {
      margin-bottom: 0;
    }

    .message.user {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .message.assistant {
      background: var(--vscode-editor-inactiveSelectionBackground);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }

    .message pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
      font-size: 12px;
    }

    .message code {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }

    .message h1, .message h2, .message h3, .message h4 {
      margin: 10px 0 6px 0;
      font-weight: 600;
    }

    .message h1 { font-size: 1.3em; }
    .message h2 { font-size: 1.2em; }
    .message h3 { font-size: 1.1em; }

    .message .chat-header-large {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin: 12px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .message .chat-header-medium {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin: 10px 0 6px 0;
    }

    .message strong {
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .message .chat-hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 12px 0;
    }

    .message ul, .message ol {
      margin: 6px 0;
      padding-left: 18px;
    }

    .message li { margin: 3px 0; }

    .message hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 10px 0;
    }

    .message p { margin: 6px 0; }
    .message p:first-child { margin-top: 0; }
    .message p:last-child { margin-bottom: 0; }

    .thinking-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      margin-bottom: 8px;
      padding: 4px 0;
    }

    .thinking-content {
      background: var(--vscode-textBlockQuote-background);
      border-left: 2px solid var(--vscode-textLink-foreground);
      padding: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      display: none;
      max-height: 200px;
      overflow-y: auto;
    }

    .thinking-content.show { display: block; }

    .streaming-indicator {
      align-self: flex-start;
      display: none;
      padding: 10px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 10px;
      border-bottom-left-radius: 4px;
      max-width: 90%;
    }

    .streaming-indicator.show { display: block; }

    .thinking-label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 4px;
      color: var(--vscode-foreground);
      font-size: 13px;
    }

    .thinking-icon {
      font-size: 16px;
    }

    .thinking-title {
      font-weight: 600;
      color: #dc2626;
    }

    .thinking-tip {
      padding: 0 16px 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      animation: tipFade 0.3s ease-in-out;
    }

    @keyframes tipFade {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .typing-dots {
      display: flex;
      gap: 4px;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--vscode-foreground);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    /* Pending Changes Panel - Claude Code Style */
    .pending-panel {
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      max-height: 40vh;
      overflow-y: auto;
      display: none;
      flex-shrink: 0;
    }

    /* Show pending panel when there are changes */
    .pending-panel.show { display: block; }

    .pending-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .pending-title {
      font-weight: 600;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pending-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
    }

    .pending-actions {
      display: flex;
      gap: 8px;
    }

    .accept-all-btn {
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
    }

    .accept-all-btn:hover { background: #218838; }

    .reject-all-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 5px 12px;
      font-size: 11px;
      cursor: pointer;
    }

    .reject-all-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .pending-close-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      margin-left: 4px;
      opacity: 0.6;
      border-radius: 4px;
    }

    .pending-close-btn:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }

    .pending-list {
      padding: 0;
    }

    .pending-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .pending-item:last-child { border-bottom: none; }

    .pending-item.applied {
      opacity: 0.5;
      background: rgba(40, 167, 69, 0.1);
    }

    .pending-item.rejected {
      opacity: 0.5;
      text-decoration: line-through;
    }

    .pending-icon {
      width: 18px;
      text-align: center;
      font-size: 12px;
    }

    .pending-info {
      flex: 1;
      min-width: 0;
    }

    .pending-path {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pending-desc {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }

    .pending-item-actions {
      display: flex;
      gap: 4px;
    }

    .item-btn {
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 10px;
      cursor: pointer;
      color: var(--vscode-foreground);
    }

    .item-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .item-btn.accept {
      background: #28a745;
      border-color: #28a745;
      color: white;
    }

    .item-btn.accept:hover { background: #218838; }

    .item-btn.preview {
      background: #0d6efd;
      border-color: #0d6efd;
      color: white;
    }

    .item-btn.preview:hover { background: #0b5ed7; }

    .item-btn.reject {
      color: #dc3545;
      border-color: #dc3545;
    }

    .item-btn.reject:hover {
      background: rgba(220, 53, 69, 0.1);
    }

    .command-item {
      background: var(--vscode-textCodeBlock-background);
    }

    .command-text {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }

    /* Pinned Files Section (Cursor-style context) */
    .pinned-files {
      padding: 8px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      display: none;
      flex-shrink: 0;
    }

    .pinned-files.show {
      display: block;
    }

    .pinned-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .pinned-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pinned-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 5px;
      border-radius: 8px;
      font-size: 9px;
    }

    .pinned-actions {
      display: flex;
      gap: 6px;
    }

    .pinned-btn {
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      cursor: pointer;
    }

    .pinned-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .pinned-btn.add {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
    }

    .pinned-btn.add:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .pinned-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .pinned-file {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 3px 6px 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      max-width: 200px;
    }

    .pinned-file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--vscode-textLink-foreground);
    }

    .pinned-file-remove {
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 0;
      font-size: 12px;
      line-height: 1;
      opacity: 0.7;
    }

    .pinned-file-remove:hover {
      opacity: 1;
      color: var(--vscode-errorForeground);
    }

    /* Team Notes - HIDDEN (removed from UI) */
    .team-notes {
      display: none !important;
    }

    .team-notes-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .team-notes-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 500;
    }

    .team-notes-hint {
      font-size: 10px;
      opacity: 0.6;
      font-weight: normal;
    }

    .team-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      padding: 3px 10px;
      cursor: pointer;
      font-size: 10px;
    }

    .team-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .team-notes-input {
      width: 100%;
      min-height: 50px;
      max-height: 100px;
      resize: vertical;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      line-height: 1.4;
    }

    .team-notes-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .add-files-hint {
      padding: 8px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
    }

    .add-files-btn {
      width: 100%;
      background: transparent;
      border: 1px dashed var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      padding: 6px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .add-files-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }

    /* Input area */
    .input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .input-area textarea {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 10px 12px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      min-height: 40px;
      max-height: 120px;
    }

    .input-area textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .input-area textarea:disabled {
      opacity: 0.6;
    }

    .send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
    }

    .send-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .cancel-btn {
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
      display: none;
    }

    .cancel-btn.show { display: block; }
    .cancel-btn:hover { background: #c82333; }

    /* Voice button */
    .voice-btn {
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 12px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      transition: all 0.2s;
    }

    .voice-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .voice-btn.listening {
      background: #dc3545;
      border-color: #dc3545;
      animation: pulse 1.5s infinite;
    }

    .voice-btn.listening::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 6px;
      border: 2px solid #dc3545;
      animation: ripple 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    @keyframes ripple {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.3); opacity: 0; }
    }

    .voice-status {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      margin-top: 4px;
      display: none;
    }

    .voice-status.show { display: block; }

    /* Welcome screen */
    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      text-align: center;
    }

    .welcome-icon { font-size: 48px; margin-bottom: 16px; }
    .welcome-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .welcome-text { color: var(--vscode-descriptionForeground); margin-bottom: 20px; max-width: 350px; font-size: 13px; }

    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .quick-action {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 16px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 12px;
    }

    .quick-action:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .quick-action.deploy {
      background: linear-gradient(135deg, #000 0%, #333 100%);
      color: white;
      border-color: #444;
    }

    .quick-action.deploy:hover {
      background: linear-gradient(135deg, #111 0%, #444 100%);
    }

    .quick-action.github {
      background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
      color: white;
      border-color: #238636;
    }

    .quick-action.github:hover {
      background: linear-gradient(135deg, #2ea043 0%, #3fb950 100%);
    }

    /* Getting Started Section */
    .getting-started {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
      max-width: 400px;
      text-align: left;
    }

    .getting-started-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--vscode-foreground);
    }

    .getting-started-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .getting-started-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .item-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .item-text {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .getting-started-examples {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-widget-border);
    }

    .examples-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
    }

    .example-chip {
      display: inline-block;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 12px;
      margin: 4px 4px 4px 0;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .example-chip:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    /* File Upload Zone */
    .file-upload-zone {
      border: 2px dashed var(--vscode-input-border);
      border-radius: 12px;
      padding: 24px 16px;
      margin: 16px 0;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--vscode-input-background);
      max-width: 400px;
    }

    .file-upload-zone:hover {
      border-color: #dc2626;
      background: rgba(220, 38, 38, 0.05);
    }

    .file-upload-zone.drag-over {
      border-color: #dc2626;
      background: rgba(220, 38, 38, 0.1);
      transform: scale(1.02);
    }

    .file-upload-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .file-upload-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .file-upload-main {
      font-size: 14px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .file-upload-sub {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .file-browse-btn {
      background: none;
      border: none;
      color: #dc2626;
      cursor: pointer;
      text-decoration: underline;
      font-size: 12px;
      padding: 0;
    }

    .file-browse-btn:hover {
      color: #b91c1c;
    }

    .file-upload-formats {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      opacity: 0.7;
    }

    /* Uploaded Files List */
    .uploaded-files {
      max-width: 400px;
      margin: 12px 0;
      background: var(--vscode-input-background);
      border-radius: 8px;
      padding: 12px;
    }

    .uploaded-files-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-size: 12px;
      font-weight: 500;
    }

    .clear-uploads-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 11px;
      padding: 2px 6px;
    }

    .clear-uploads-btn:hover {
      color: #dc2626;
    }

    .uploaded-files-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .uploaded-file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--vscode-editor-background);
      border-radius: 6px;
      font-size: 12px;
    }

    .uploaded-file-icon {
      font-size: 14px;
    }

    .uploaded-file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .uploaded-file-size {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .remove-file-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      padding: 0 4px;
      opacity: 0.6;
    }

    .remove-file-btn:hover {
      color: #dc2626;
      opacity: 1;
    }

    /* Persistent Action Bar (always visible) */
    .action-bar {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      background: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-panel-border);
      flex-wrap: wrap;
      justify-content: center;
    }

    .action-bar .action-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 12px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .action-bar .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .action-bar .action-btn.github {
      background: #238636;
      color: white;
      border-color: #238636;
    }

    .action-bar .action-btn.github:hover {
      background: #2ea043;
    }

    .action-bar .action-btn.deploy {
      background: #333;
      color: white;
      border-color: #444;
    }

    .action-bar .action-btn.deploy:hover {
      background: #444;
    }

    .action-bar .action-btn.mindmap {
      background: #1e3a5f;
      color: #60a5fa;
      border-color: #3b82f6;
    }

    .action-bar .action-btn.mindmap:hover {
      background: #2563eb;
      color: white;
    }

    .action-bar .action-btn.preview {
      background: #0d9488;
      color: white;
      border-color: #14b8a6;
    }

    .action-bar .action-btn.preview:hover {
      background: #14b8a6;
    }

    /* Login prompt */
    .login-prompt {
      flex: 1;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      text-align: center;
    }

    .login-prompt.show { display: flex; }

    .login-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      margin-top: 16px;
    }

    .login-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Onboarding Container - HIDDEN (Option D: Welcome screen only) */
    .onboarding-container {
      display: none !important;
    }

    .onboarding-container.show {
      display: none !important;
    }

    .onboarding-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
    }

    .onboarding-step {
      padding: 24px;
      text-align: center;
    }

    .onboarding-step h2 {
      margin: 16px 0 8px;
      font-size: 1.5rem;
      color: var(--vscode-foreground);
    }

    .onboarding-step p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
    }

    .onboarding-step .subtitle {
      font-size: 0.875rem;
      margin-bottom: 24px;
    }

    .step-indicator {
      font-size: 0.75rem;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .onboarding-icon {
      color: #dc2626;
      margin-bottom: 8px;
    }

    .onboarding-primary-btn {
      background: #dc2626;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .onboarding-primary-btn:hover {
      background: #b91c1c;
    }

    .onboarding-primary-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .onboarding-secondary-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      margin-left: 8px;
    }

    .skill-options, .project-options, .method-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 20px;
    }

    .skill-btn, .project-btn, .method-btn {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 16px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.2s;
      position: relative;
      color: var(--vscode-foreground);
    }

    .skill-btn:hover, .project-btn:hover, .method-btn:hover {
      border-color: #dc2626;
    }

    .skill-btn.recommended, .method-btn.recommended {
      border-color: #dc2626;
    }

    .skill-icon, .project-icon, .method-icon {
      font-size: 1.5rem;
      margin-bottom: 8px;
    }

    .skill-title, .project-title, .method-title {
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 4px;
    }

    .skill-desc, .project-desc, .method-desc {
      font-size: 0.875rem;
      color: var(--vscode-descriptionForeground);
    }

    .recommended-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 0.75rem;
      background: #dc2626;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .onboarding-form-group {
      margin-bottom: 16px;
      text-align: left;
    }

    .onboarding-form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .onboarding-form-group input,
    .onboarding-form-group textarea,
    .onboarding-form-group select {
      width: 100%;
      padding: 10px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      color: var(--vscode-foreground);
      font-size: 0.875rem;
    }

    .onboarding-form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .stack-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 20px 0;
      text-align: left;
    }

    .stack-item {
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }

    .stack-label {
      display: block;
      font-size: 0.75rem;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }

    .stack-value {
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .success-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }

    /* Status indicator */
    .status-indicator {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      font-size: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .status-indicator.show { display: flex; }

    .status-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Progress bar */
    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--vscode-progressBar-foreground, #0e7ad3);
      border-radius: 2px;
      transition: width 0.2s ease;
    }

    /* ========================================
       LIVE PREVIEW - Split Screen Layout
       ======================================== */

    .preview-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--vscode-button-secondaryBackground, #3c3c3c);
      border-radius: 4px;
      color: var(--vscode-foreground);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-right: auto;
    }

    .preview-toggle:hover {
      background: var(--vscode-button-secondaryHoverBackground, #454545);
    }

    .preview-toggle.active {
      background: var(--vscode-button-background, #0e639c);
      border-color: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }

    .preview-toggle .toggle-icon {
      font-size: 12px;
    }

    .split-container {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .split-container .main-content {
      flex: 1 !important;
      min-width: 0;
      max-width: 100% !important;
    }

    /* Preview panel removed - main content always 100% */
    .split-container.preview-active .main-content {
      flex: 1 !important;
    }

    /* Preview styles kept for compatibility but panel is hidden */
    .preview-header {
      display: none;
      flex-direction: column;
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      background: var(--vscode-titleBar-activeBackground, #1e1e1e);
    }

    .preview-title {
      font-weight: 600;
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .preview-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
      margin-top: 2px;
    }

    .preview-canvas {
      flex: 1;
      position: relative;
      overflow: auto;
      /* Figma/Linear style - dark with subtle dot grid */
      background: #0d0d0d;
      background-image:
        radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
      background-size: 24px 24px;
      padding: 32px;
    }

    /* Building Animation Overlay */
    .building-overlay {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      z-index: 10;
    }

    .building-overlay.active {
      display: flex;
    }

    .building-animation {
      text-align: center;
      color: var(--vscode-foreground);
    }

    .blueprint-grid {
      width: 120px;
      height: 80px;
      margin: 0 auto 16px;
      border: 2px solid var(--vscode-button-background, #0e639c);
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      animation: blueprintPulse 2s ease-in-out infinite;
    }

    .blueprint-grid::before,
    .blueprint-grid::after {
      content: '';
      position: absolute;
      background: var(--vscode-button-background, #0e639c);
      opacity: 0.3;
    }

    .blueprint-grid::before {
      width: 100%;
      height: 1px;
      top: 50%;
      animation: scanLine 1.5s ease-in-out infinite;
    }

    .blueprint-grid::after {
      width: 1px;
      height: 100%;
      left: 50%;
      animation: scanLine 1.5s ease-in-out infinite 0.75s;
    }

    @keyframes blueprintPulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.02); opacity: 1; }
    }

    @keyframes scanLine {
      0% { opacity: 0.1; }
      50% { opacity: 0.5; }
      100% { opacity: 0.1; }
    }

    .building-text {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .building-dots {
      display: flex;
      gap: 4px;
      justify-content: center;
    }

    .building-dots span {
      width: 6px;
      height: 6px;
      background: var(--vscode-button-background, #0e639c);
      border-radius: 50%;
      animation: buildingDot 1.4s ease-in-out infinite;
    }

    .building-dots span:nth-child(2) { animation-delay: 0.2s; }
    .building-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes buildingDot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Preview Nodes - Vertical Cascade Mind Map */
    .preview-nodes {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-height: 100%;
      padding-bottom: 40px;
    }

    .preview-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground, #888);
      padding: 0 4px;
      margin-bottom: 4px;
    }

    .preview-section-nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Figma/Linear Style Nodes */
    .preview-node {
      position: relative;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(30, 30, 30, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.03);
      cursor: pointer;
      opacity: 0;
      transform: translateY(10px) scale(0.95);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      backdrop-filter: blur(8px);
      color: rgba(255, 255, 255, 0.9);
    }

    .preview-node.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .preview-node:hover {
      background: rgba(40, 40, 40, 0.95);
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.08);
      transform: translateY(-2px) scale(1.02);
    }

    .preview-node.selected {
      border-color: #6366f1;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 0 0 2px rgba(99, 102, 241, 0.4),
        0 0 24px rgba(99, 102, 241, 0.15);
    }

    .preview-node .node-icon {
      margin-right: 8px;
      font-size: 14px;
    }

    .preview-node .node-label {
      font-weight: 600;
      display: block;
      letter-spacing: 0.2px;
    }

    .preview-node .node-name {
      font-size: 11px;
      opacity: 0.5;
      display: block;
      margin-top: 3px;
      font-weight: 400;
    }

    /* Node Action Buttons */
    .node-actions {
      position: absolute;
      top: -8px;
      right: -8px;
      display: none;
      gap: 4px;
      z-index: 10;
    }

    .preview-node:hover .node-actions,
    .preview-node.selected .node-actions {
      display: flex;
    }

    .node-action-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .node-action-btn.generate {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
    }

    .node-action-btn.generate:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
    }

    .node-action-btn.edit {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }

    .node-action-btn.edit:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    /* Health Indicators */
    .node-health {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 3px;
    }

    .health-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.3);
      cursor: help;
    }

    .health-indicator.warning {
      background: #f59e0b;
      animation: healthPulse 2s infinite;
    }

    .health-indicator.error {
      background: #ef4444;
      animation: healthPulse 1.5s infinite;
    }

    .health-indicator.success {
      background: #22c55e;
    }

    @keyframes healthPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }

    /* Selected node state */
    .preview-node.selected {
      box-shadow: 0 0 0 3px var(--vscode-focusBorder, #007fd4), 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    /* Tooltip Popup - Modern dark style */
    .preview-tooltip {
      position: fixed;
      max-width: 280px;
      padding: 14px 18px;
      background: rgba(20, 20, 20, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.9);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 1000;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(16px);
    }

    .preview-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .preview-tooltip-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: #fff;
      font-size: 14px;
    }

    .preview-tooltip-desc {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      line-height: 1.6;
    }

    /* Node type colors - Dark theme with colored accents */
    .preview-node[data-type="page"] {
      border-left: 3px solid #3b82f6;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(59, 130, 246, 0.05);
    }
    .preview-node[data-type="page"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.15); }

    .preview-node[data-type="component"] {
      border-left: 3px solid #22c55e;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(34, 197, 94, 0.05);
    }
    .preview-node[data-type="component"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.15); }

    .preview-node[data-type="api"] {
      border-left: 3px solid #f59e0b;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(245, 158, 11, 0.05);
    }
    .preview-node[data-type="api"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.15); }

    .preview-node[data-type="database"] {
      border-left: 3px solid #ec4899;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(236, 72, 153, 0.05);
    }
    .preview-node[data-type="database"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(236, 72, 153, 0.15); }

    .preview-node[data-type="type"] {
      border-left: 3px solid #6366f1;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(99, 102, 241, 0.05);
    }
    .preview-node[data-type="type"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.15); }

    .preview-node[data-type="service"] {
      border-left: 3px solid #14b8a6;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(20, 184, 166, 0.05);
    }
    .preview-node[data-type="service"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(20, 184, 166, 0.15); }

    .preview-node[data-type="middleware"] {
      border-left: 3px solid #f97316;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(249, 115, 22, 0.05);
    }
    .preview-node[data-type="middleware"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.15); }

    .preview-node[data-type="hook"] {
      border-left: 3px solid #a855f7;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(168, 85, 247, 0.05);
    }
    .preview-node[data-type="hook"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.15); }

    .preview-node[data-type="context"] {
      border-left: 3px solid #06b6d4;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(6, 182, 212, 0.05);
    }
    .preview-node[data-type="context"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(6, 182, 212, 0.15); }

    .preview-node[data-type="action"] {
      border-left: 3px solid #ef4444;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(239, 68, 68, 0.05);
    }
    .preview-node[data-type="action"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15); }

    .preview-node[data-type="job"] {
      border-left: 3px solid #6b7280;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(107, 114, 128, 0.05);
    }
    .preview-node[data-type="job"]:hover { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(107, 114, 128, 0.15); }

    /* Preview Edges (SVG) - Modern glowing connection lines */
    .preview-edges {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      overflow: visible;
    }

    .preview-edge {
      fill: none;
      stroke-width: 1.5;
      opacity: 0;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: opacity 0.4s ease, stroke-width 0.2s ease, filter 0.2s ease;
    }

    .preview-edge.visible {
      opacity: 0.6;
      animation: fadeInEdge 0.6s ease forwards;
    }

    .preview-edge.renders { stroke: #3b82f6; filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.4)); }
    .preview-edge.calls { stroke: #f59e0b; filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.4)); }
    .preview-edge.uses { stroke: #a855f7; filter: drop-shadow(0 0 3px rgba(168, 85, 247, 0.4)); }
    .preview-edge.queries { stroke: #ec4899; filter: drop-shadow(0 0 3px rgba(236, 72, 153, 0.4)); }
    .preview-edge.default { stroke: rgba(255, 255, 255, 0.2); }

    .preview-edge:hover {
      stroke-width: 3;
      opacity: 1;
      filter: drop-shadow(0 0 8px currentColor);
    }

    /* Edge Explanation Tooltip */
    .edge-explanation-tooltip {
      animation: tooltipFadeIn 0.2s ease;
    }

    .edge-explanation-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }

    .edge-explanation-desc {
      color: var(--vscode-descriptionForeground, #999);
      line-height: 1.5;
    }

    @keyframes tooltipFadeIn {
      from { opacity: 0; transform: translate(-50%, -100%) translateY(10px); }
      to { opacity: 1; transform: translate(-50%, -100%); }
    }

    /* Connection dots at endpoints */
    .edge-dot {
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .edge-dot.visible {
      opacity: 0.8;
    }

    .edge-dot.renders { fill: #3b82f6; }
    .edge-dot.calls { fill: #f59e0b; }
    .edge-dot.uses { fill: #a855f7; }
    .edge-dot.queries { fill: #ec4899; }
    .edge-dot.default { fill: #6b7280; }

    @keyframes fadeInEdge {
      from { opacity: 0; }
      to { opacity: 0.5; }
    }

    /* Connection Legend - minimal dark style */
    .connection-legend {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: none;
      gap: 16px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      z-index: 10;
      backdrop-filter: blur(8px);
    }

    .connection-legend.visible {
      display: flex;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-line {
      width: 20px;
      height: 2px;
      border-radius: 1px;
      box-shadow: 0 0 6px currentColor;
    }

    .legend-line.renders { background: #3b82f6; color: #3b82f6; }
    .legend-line.calls { background: #f59e0b; color: #f59e0b; }
    .legend-line.uses { background: #a855f7; color: #a855f7; }

    /* AI Suggestions Panel */
    .suggestions-panel {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 240px;
      max-height: 300px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 20;
      overflow: hidden;
      display: none;
    }

    .suggestions-panel.visible {
      display: block;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .suggestions-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-titleBar-activeBackground, #252526);
    }

    .suggestions-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .suggestions-close {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
    }

    .suggestions-close:hover {
      color: var(--vscode-foreground);
    }

    .suggestions-list {
      padding: 8px;
      max-height: 220px;
      overflow-y: auto;
    }

    .suggestion-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s ease;
      margin-bottom: 6px;
    }

    .suggestion-item:last-child {
      margin-bottom: 0;
    }

    .suggestion-item:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    .suggestion-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .suggestion-content {
      flex: 1;
      min-width: 0;
    }

    .suggestion-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 2px;
    }

    .suggestion-reason {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
      line-height: 1.4;
    }

    .suggestion-add {
      font-size: 16px;
      color: var(--vscode-button-background, #0e639c);
      flex-shrink: 0;
    }

    /* Templates Gallery */
    .templates-gallery {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-height: 500px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      z-index: 100;
      display: none;
      overflow: hidden;
    }

    .templates-gallery.visible {
      display: block;
      animation: scaleIn 0.2s ease;
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .templates-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
    }

    .templates-title {
      font-size: 14px;
      font-weight: 600;
    }

    .templates-close {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 18px;
    }

    .templates-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }

    .template-card {
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-panel-border, #555);
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .template-card:hover {
      border-color: var(--vscode-button-background, #0e639c);
      transform: translateY(-2px);
    }

    .template-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .template-name {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .template-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    /* Progress Stats (bottom of canvas) */
    .canvas-stats {
      position: absolute;
      bottom: 12px;
      left: 12px;
      display: flex;
      gap: 16px;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #333);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      z-index: 10;
    }

    .canvas-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .canvas-stat-value {
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    /* Keyboard hints - minimal dark style */
    .keyboard-hints {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 16px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
      background: rgba(0, 0, 0, 0.4);
      padding: 8px 16px;
      border-radius: 8px;
      backdrop-filter: blur(8px);
    }

    .kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Monaco, monospace;
      margin-right: 6px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Empty State - elegant dark */
    .preview-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.4);
    }

    .preview-empty.hidden {
      display: none;
    }

    .empty-icon {
      font-size: 56px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .empty-text {
      font-size: 14px;
      text-align: center;
      max-width: 240px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.4);
    }
  </style>
</head>
<body>
  <!-- Toast Container for auto-applied files -->
  <div class="toast-container" id="toastContainer"></div>

  <div class="header">
    <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4 L10 12 L4 20 L8 20 L12 14 L16 20 L20 20 L14 12 L20 4 L16 4 L12 10 L8 4 Z"/>
    </svg>
    <span class="header-title">CodeBakers</span>
    <span class="plan-badge" id="planBadge">Pro</span>
    <button class="header-btn" id="clearBtn">Clear</button>
  </div>

  <div class="session-stats" id="sessionStats">
    <div class="stat">
      <span class="stat-label">Requests:</span>
      <span class="stat-value" id="statRequests">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">Tokens:</span>
      <span class="stat-value" id="statTokens">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">Session Cost:</span>
      <span class="stat-value cost" id="statCost">$0.0000</span>
    </div>
    <div class="stat">
      <span class="stat-label">Time:</span>
      <span class="stat-value" id="statTime">0m</span>
    </div>
    <button class="reset-btn" id="resetStatsBtn" title="Reset session stats">↺ Reset</button>
  </div>

  <div class="login-prompt" id="loginPrompt">
    <div class="welcome-icon">🔐</div>
    <div class="welcome-title">Sign in to CodeBakers</div>
    <div class="welcome-text">Connect with GitHub to start your free trial.</div>
    <button class="login-btn" id="loginBtn">Sign in with GitHub</button>
  </div>

  <div class="split-container" id="splitContainer">
    <div class="main-content" id="mainContent">
      <div class="messages" id="messages">
      <div class="welcome" id="welcome">
        <div class="welcome-icon">🍪</div>
        <div class="welcome-title">What would you like to build?</div>
        <div class="welcome-text">Describe your idea in plain English, or drop files below to get started.</div>

        <!-- File Upload Zone -->
        <div class="file-upload-zone" id="fileUploadZone">
          <div class="file-upload-icon">📄</div>
          <div class="file-upload-text">
            <span class="file-upload-main">Drop PRD, specs, or mockups here</span>
            <span class="file-upload-sub">or <button class="file-browse-btn" id="fileBrowseBtn">browse files</button></span>
          </div>
          <div class="file-upload-formats">PDF, TXT, MD, PNG, JPG supported</div>
          <input type="file" id="fileInput" multiple accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.doc,.docx" style="display: none;" />
        </div>

        <!-- Uploaded Files List -->
        <div class="uploaded-files" id="uploadedFiles" style="display: none;">
          <div class="uploaded-files-header">
            <span>📎 Attached files</span>
            <button class="clear-uploads-btn" id="clearUploadsBtn">Clear all</button>
          </div>
          <div class="uploaded-files-list" id="uploadedFilesList"></div>
        </div>

        <div class="getting-started">
          <div class="getting-started-title">How it works</div>
          <div class="getting-started-items">
            <div class="getting-started-item">
              <span class="item-icon">💬</span>
              <span class="item-text">Tell me what you need - I'll write the code</span>
            </div>
            <div class="getting-started-item">
              <span class="item-icon">✨</span>
              <span class="item-text">Changes apply automatically - undo anytime!</span>
            </div>
            <div class="getting-started-item">
              <span class="item-icon">📄</span>
              <span class="item-text">Upload PRD or specs for better context</span>
            </div>
            <div class="getting-started-item">
              <span class="item-icon">🧪</span>
              <span class="item-text">Tests and type-checking run automatically</span>
            </div>
          </div>
          <div class="getting-started-examples">
            <div class="examples-label">Try saying:</div>
            <div class="example-chip">"Build me a SaaS dashboard"</div>
            <div class="example-chip">"Add user authentication"</div>
            <div class="example-chip">"Create an API for invoices"</div>
          </div>
        </div>
      </div>

      <div class="streaming-indicator" id="streaming">
        <div class="thinking-label">
          <span class="thinking-icon">🍪</span>
          <span class="thinking-title">CodeBakers Tip:</span>
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        <div class="thinking-tip" id="thinkingTip">Just describe what you want in plain English!</div>
        <div id="streamingContent" style="display: none;"></div>
      </div>

    </div>
    </div>
  </div>

  <!-- Pinned Files Section (Cursor-style context) -->
  <div class="pinned-files" id="pinnedFiles">
    <div class="pinned-header">
      <div class="pinned-title">
        <span>📎 Context Files</span>
        <span class="pinned-count" id="pinnedCount">0</span>
      </div>
      <div class="pinned-actions">
        <button class="pinned-btn" id="clearPinnedBtn">Clear</button>
        <button class="pinned-btn add" id="addPinnedBtn">+ Add</button>
      </div>
    </div>
    <div class="pinned-list" id="pinnedList"></div>
  </div>

  <!-- Team Notes Section (shared project context for team) -->
  <div class="team-notes" id="teamNotes">
    <div class="team-notes-header">
      <div class="team-notes-title">
        <span>👥 Team Notes</span>
        <span class="team-notes-hint">(shared with team)</span>
      </div>
      <div class="team-notes-actions">
        <button class="team-btn" id="saveTeamNotesBtn">Save</button>
      </div>
    </div>
    <textarea class="team-notes-input" id="teamNotesInput" placeholder="Add shared notes, decisions, or context for your team..."></textarea>
  </div>

  <!-- Add Files Button (shown when no files pinned) -->
  <div class="add-files-hint" id="addFilesHint">
    <button class="add-files-btn" id="addFilesBtn">
      <span>📎</span>
      <span>Add files to context (always included in chat)</span>
    </button>
  </div>

  <!-- Persistent Action Bar -->
  <div class="action-bar">
    <button class="action-btn" data-action="/audit">🔍 Audit</button>
    <button class="action-btn" data-action="/test">🧪 Test</button>
    <button class="action-btn" data-action="/fix">🔧 Fix</button>
    <button class="action-btn mindmap" data-action="/mindmap">🗺️ Map</button>
    <button class="action-btn github" data-action="/git-push">📤 Push</button>
    <button class="action-btn deploy" data-action="/deploy">🚀 Deploy</button>
    <button class="action-btn preview" data-action="/preview" title="Open app in browser">👁️ Preview</button>
  </div>

  <div class="input-area">
    <textarea
      id="input"
      placeholder="Ask CodeBakers anything..."
      rows="1"
    ></textarea>
    <button class="voice-btn" id="voiceBtn" title="Voice input (click to speak)">🎤</button>
    <button class="send-btn" id="sendBtn">Send</button>
    <button class="cancel-btn" id="cancelBtn">Cancel</button>
  </div>
  <div class="voice-status" id="voiceStatus">Listening...</div>

  <script>
    console.log('CodeBakers: Script starting...');
    try {
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const loginPromptEl = document.getElementById('loginPrompt');
    const mainContentEl = document.getElementById('mainContent');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const streamingEl = document.getElementById('streaming');
    const streamingContentEl = document.getElementById('streamingContent');
    const pendingPanel = document.getElementById('pendingPanel');
    const pendingList = document.getElementById('pendingList');
    const pendingCount = document.getElementById('pendingCount');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const pinnedFilesEl = document.getElementById('pinnedFiles');
    const pinnedListEl = document.getElementById('pinnedList');
    const pinnedCountEl = document.getElementById('pinnedCount');
    const addFilesHint = document.getElementById('addFilesHint');

    // Live Preview elements
    const previewToggleBtn = document.getElementById('previewToggle');
    const splitContainer = document.getElementById('splitContainer');
    const previewPanel = document.getElementById('previewPanel');
    const buildingOverlay = document.getElementById('buildingOverlay');
    const previewNodes = document.getElementById('previewNodes');
    const previewEdges = document.getElementById('previewEdges');
    const previewEmpty = document.getElementById('previewEmpty');
    const previewCanvas = document.getElementById('previewCanvas');

    // Canvas Mode elements
    const canvasModeBtn = document.getElementById('canvasModeBtn');
    const classicModeBtn = document.getElementById('classicModeBtn');
    const pendingBadge = document.getElementById('pendingBadge');
    const pendingBadgeCount = document.getElementById('pendingBadgeCount');
    const pendingOverlay = document.getElementById('pendingOverlay');
    const pendingSlideout = document.getElementById('pendingSlideout');
    const pendingSlideoutCount = document.getElementById('pendingSlideoutCount');
    const pendingSlideoutContent = document.getElementById('pendingSlideoutContent');
    const pendingSlideoutClose = document.getElementById('pendingSlideoutClose');
    const slideoutAcceptAll = document.getElementById('slideoutAcceptAll');
    const slideoutRejectAll = document.getElementById('slideoutRejectAll');
    const aiResponseBar = document.getElementById('aiResponseBar');
    const aiResponseHeader = document.getElementById('aiResponseHeader');
    const aiResponseStatus = document.getElementById('aiResponseStatus');
    const aiResponseSummary = document.getElementById('aiResponseSummary');
    const aiResponseToggle = document.getElementById('aiResponseToggle');
    const aiResponseContent = document.getElementById('aiResponseContent');
    const aiResponseText = document.getElementById('aiResponseText');
    const canvasChatInput = document.getElementById('canvasChatInput');
    const canvasInput = document.getElementById('canvasInput');
    const canvasInputContext = document.getElementById('canvasInputContext');
    const canvasSendBtn = document.getElementById('canvasSendBtn');
    const canvasVoiceBtn = document.getElementById('canvasVoiceBtn');

    // Onboarding elements
    const onboardingContainer = document.getElementById('onboardingContainer');
    const onboardingContent = document.getElementById('onboardingContent');
    let onboardingActive = false;

    // Onboarding action handler (global function for onclick)
    window.handleOnboarding = function(action, data) {
      vscode.postMessage({
        type: 'onboarding-action',
        action: action,
        data: data || {}
      });
    };

    // Pre-Flight Impact Check elements
    const preflightPanel = document.getElementById('preflightPanel');
    const preflightFiles = document.getElementById('preflightFiles');
    const preflightWarnings = document.getElementById('preflightWarnings');
    const preflightWarningText = document.getElementById('preflightWarningText');
    const preflightProceed = document.getElementById('preflightProceed');
    const preflightCancel = document.getElementById('preflightCancel');

    let currentMessages = [];
    let currentChanges = [];
    let currentCommands = [];
    let currentPinnedFiles = [];
    let isStreaming = false;

    // CodeBakers Tips - shown during thinking
    const codeBakersTips = [
      "Just describe what you want in plain English!",
      "Say 'add a login page' - I'll handle the rest.",
      "Changes auto-apply by default. You can undo anytime!",
      "I write tests for everything automatically.",
      "All code follows production-ready patterns.",
      "Try: 'Fix the TypeScript errors' - I'll find and fix them.",
      "Pin files for context - they're included in every message.",
      "Say 'review my code' for a quality audit.",
      "I can clone designs from screenshots or URLs!",
      "Every feature gets proper error handling.",
      "Say 'deploy' when you're ready to ship!",
      "I run TypeScript checks after every change.",
      "Try: 'Add dark mode' - I'll wire it all up.",
      "All database queries use safe, typed patterns.",
      "Say 'add tests' and I'll create comprehensive tests.",
      "I preserve your existing code style.",
      "Authentication? Payments? Just ask!",
      "Your project state is saved - I remember context.",
      "Try: 'Optimize this' for performance improvements.",
      "I follow your stack - no random rewrites!"
    ];
    let tipIndex = 0;
    let tipInterval = null;
    const thinkingTipEl = document.getElementById('thinkingTip');

    function startTipCycling() {
      tipIndex = Math.floor(Math.random() * codeBakersTips.length);
      if (thinkingTipEl) thinkingTipEl.textContent = codeBakersTips[tipIndex];
      tipInterval = setInterval(() => {
        tipIndex = (tipIndex + 1) % codeBakersTips.length;
        if (thinkingTipEl) {
          thinkingTipEl.style.animation = 'none';
          thinkingTipEl.offsetHeight; // Force reflow
          thinkingTipEl.style.animation = 'tipFade 0.3s ease-in-out';
          thinkingTipEl.textContent = codeBakersTips[tipIndex];
        }
      }, 4000); // Change tip every 4 seconds
    }

    function stopTipCycling() {
      if (tipInterval) {
        clearInterval(tipInterval);
        tipInterval = null;
      }
    }

    // =========================================
    // File Upload Handlers (PRD, specs, mockups)
    // =========================================
    const fileUploadZone = document.getElementById('fileUploadZone');
    const fileInput = document.getElementById('fileInput');
    const fileBrowseBtn = document.getElementById('fileBrowseBtn');
    const uploadedFilesEl = document.getElementById('uploadedFiles');
    const uploadedFilesList = document.getElementById('uploadedFilesList');
    const clearUploadsBtn = document.getElementById('clearUploadsBtn');

    let uploadedContextFiles = []; // Store uploaded file data

    // File type icons
    function getFileIcon(filename) {
      const ext = filename.split('.').pop().toLowerCase();
      const icons = {
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'txt': '📄',
        'md': '📝',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️'
      };
      return icons[ext] || '📄';
    }

    // Format file size
    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Handle file selection
    async function handleFiles(files) {
      for (const file of files) {
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.warn('File too large:', file.name);
          continue;
        }

        // Check if file already uploaded
        if (uploadedContextFiles.find(f => f.name === file.name)) {
          continue;
        }

        try {
          const content = await readFileContent(file);
          uploadedContextFiles.push({
            name: file.name,
            size: file.size,
            type: file.type,
            content: content
          });
        } catch (err) {
          console.error('Failed to read file:', file.name, err);
        }
      }
      renderUploadedFiles();
    }

    // Read file content
    function readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (file.type.startsWith('image/')) {
            // For images, store base64
            resolve(reader.result);
          } else {
            // For text files, store text
            resolve(reader.result);
          }
        };
        reader.onerror = reject;

        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }

    // Render uploaded files list
    function renderUploadedFiles() {
      if (!uploadedFilesList || !uploadedFilesEl) return;

      if (uploadedContextFiles.length === 0) {
        uploadedFilesEl.style.display = 'none';
        return;
      }

      uploadedFilesEl.style.display = 'block';
      uploadedFilesList.innerHTML = uploadedContextFiles.map((file, index) => \`
        <div class="uploaded-file-item" data-index="\${index}">
          <span class="uploaded-file-icon">\${getFileIcon(file.name)}</span>
          <span class="uploaded-file-name">\${file.name}</span>
          <span class="uploaded-file-size">\${formatFileSize(file.size)}</span>
          <button class="remove-file-btn" onclick="removeUploadedFile(\${index})">×</button>
        </div>
      \`).join('');
    }

    // Remove uploaded file
    window.removeUploadedFile = function(index) {
      uploadedContextFiles.splice(index, 1);
      renderUploadedFiles();
    };

    // Get uploaded files context for message
    function getUploadedFilesContext() {
      if (uploadedContextFiles.length === 0) return '';

      let context = '\\n\\n--- ATTACHED FILES ---\\n';
      for (const file of uploadedContextFiles) {
        if (file.type.startsWith('image/')) {
          context += \`\\n[Image: \${file.name}]\\n\`;
          // Image will be sent separately
        } else {
          context += \`\\n### \${file.name}\\n\${file.content}\\n\`;
        }
      }
      return context;
    }

    // Drag and drop handlers
    if (fileUploadZone) {
      fileUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadZone.classList.add('drag-over');
      });

      fileUploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadZone.classList.remove('drag-over');
      });

      fileUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          handleFiles(e.dataTransfer.files);
        }
      });

      fileUploadZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleFiles(e.target.files);
        }
      });
    }

    if (fileBrowseBtn) {
      fileBrowseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fileInput) fileInput.click();
      });
    }

    if (clearUploadsBtn) {
      clearUploadsBtn.addEventListener('click', () => {
        uploadedContextFiles = [];
        renderUploadedFiles();
      });
    }

    // Live Preview state
    let previewEnabled = true;
    let previewNodesData = [];
    let previewEdgesData = [];

    // Canvas Mode state
    let isCanvasMode = true; // Default to canvas mode
    let selectedNodeId = null;
    let aiResponseExpanded = false;

    // Session stats elements
    const statRequestsEl = document.getElementById('statRequests');
    const statTokensEl = document.getElementById('statTokens');
    const statCostEl = document.getElementById('statCost');
    const statTimeEl = document.getElementById('statTime');
    const resetStatsBtn = document.getElementById('resetStatsBtn');

    // Session stats tracking
    let sessionStats = {
      requests: 0,
      tokens: 0,
      cost: 0,
      startTime: Date.now(),
      activeTime: 0, // in milliseconds
      lastActivity: Date.now(),
      isActive: true
    };

    // Activity detection constants
    const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes of no activity = idle
    const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

    // Update session time every minute
    setInterval(() => {
      updateSessionTime();
    }, 60000);

    // Activity detection - pause timer when user is idle
    setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - sessionStats.lastActivity;

      if (timeSinceActivity > IDLE_THRESHOLD && sessionStats.isActive) {
        // User went idle
        sessionStats.isActive = false;
        if (statTimeEl) {
          statTimeEl.style.opacity = '0.5'; // Dim to show idle
          statTimeEl.title = 'Timer paused (idle)';
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Track user activity
    function recordActivity() {
      const now = Date.now();
      if (!sessionStats.isActive) {
        // User came back from idle
        sessionStats.isActive = true;
        if (statTimeEl) {
          statTimeEl.style.opacity = '1';
          statTimeEl.title = '';
        }
      } else {
        // Add active time since last activity (capped at reasonable amount)
        const timeDiff = Math.min(now - sessionStats.lastActivity, IDLE_THRESHOLD);
        sessionStats.activeTime += timeDiff;
      }
      sessionStats.lastActivity = now;
    }

    // Register activity on user interactions
    if (inputEl) {
      inputEl.addEventListener('input', recordActivity);
      inputEl.addEventListener('focus', recordActivity);
    }
    document.addEventListener('click', recordActivity);
    document.addEventListener('keydown', recordActivity);

    // Toggle collapsible code blocks
    function toggleCodeBlock(blockId) {
      const block = document.getElementById(blockId);
      if (block) {
        block.classList.toggle('collapsed');
      }
    }
    // Make toggleCodeBlock globally accessible for onclick handlers
    window.toggleCodeBlock = toggleCodeBlock;

    // Pre-Flight Impact Check logic
    let pendingPreflightMessage = null;

    function isCodeRelatedRequest(message) {
      const codeKeywords = [
        'add', 'create', 'build', 'implement', 'fix', 'update', 'change',
        'modify', 'write', 'edit', 'refactor', 'delete', 'remove',
        'feature', 'component', 'page', 'api', 'route', 'function',
        'button', 'form', 'modal', 'table', 'chart', 'endpoint',
        'style', 'css', 'layout', 'design'
      ];
      const messageLower = message.toLowerCase();
      return codeKeywords.some(keyword => messageLower.includes(keyword));
    }

    function showPreflightPanel(message, impactData) {
      if (!preflightPanel || !preflightFiles) return;

      // Clear previous content
      preflightFiles.innerHTML = '';

      // Show affected files
      if (impactData && impactData.files && impactData.files.length > 0) {
        impactData.files.forEach(file => {
          const fileEl = document.createElement('span');
          fileEl.className = 'preflight-file' + (file.impact ? ' ' + file.impact + '-impact' : '');
          fileEl.textContent = file.name || file;
          preflightFiles.appendChild(fileEl);
        });
      } else {
        // Show placeholder based on message analysis
        const placeholderFiles = analyzeMessageForFiles(message);
        placeholderFiles.forEach(file => {
          const fileEl = document.createElement('span');
          fileEl.className = 'preflight-file';
          fileEl.textContent = file;
          preflightFiles.appendChild(fileEl);
        });
      }

      // Show warnings if any
      if (impactData && impactData.warning) {
        preflightWarnings.style.display = 'block';
        preflightWarningText.textContent = impactData.warning;
      } else {
        preflightWarnings.style.display = 'none';
      }

      preflightPanel.classList.add('show');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function analyzeMessageForFiles(message) {
      const files = [];
      const msgLower = message.toLowerCase();

      // Detect common patterns and suggest likely files
      if (msgLower.includes('api') || msgLower.includes('endpoint') || msgLower.includes('route')) {
        files.push('src/app/api/...');
      }
      if (msgLower.includes('page') || msgLower.includes('component')) {
        files.push('src/app/...');
        files.push('src/components/...');
      }
      if (msgLower.includes('database') || msgLower.includes('schema') || msgLower.includes('table')) {
        files.push('src/lib/db/schema.ts');
      }
      if (msgLower.includes('auth') || msgLower.includes('login')) {
        files.push('src/lib/auth.ts');
      }
      if (msgLower.includes('style') || msgLower.includes('css')) {
        files.push('*.css / *.module.css');
      }

      // Default if nothing detected
      if (files.length === 0) {
        files.push('Files will be analyzed...');
      }

      return files;
    }

    function hidePreflightPanel() {
      if (preflightPanel) {
        preflightPanel.classList.remove('show');
      }
      pendingPreflightMessage = null;
    }

    function proceedWithMessage() {
      if (pendingPreflightMessage) {
        const message = pendingPreflightMessage;
        hidePreflightPanel();
        actualSendMessage(message);
      }
    }

    // Pre-flight button handlers
    if (preflightProceed) {
      preflightProceed.addEventListener('click', proceedWithMessage);
    }
    if (preflightCancel) {
      preflightCancel.addEventListener('click', hidePreflightPanel);
    }

    // Ripple Check - show coherence results after code changes
    function showRippleCheck(data) {
      if (!messagesEl) return;

      // Determine status
      const status = data.errors > 0 ? 'error' : (data.warnings > 0 ? 'warning' : 'success');
      const statusIcons = {
        success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.78 5.28l-4.5 6a.75.75 0 0 1-1.06.06l-2.5-2.25a.75.75 0 1 1 1.01-1.11l1.94 1.74 4-5.33a.75.75 0 0 1 1.17.94z"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm0 4v4h.01V5H8zm0 6v1h.01v-1H8z"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 10.44L10.44 11.5 8 9.06 5.56 11.5 4.5 10.44 6.94 8 4.5 5.56 5.56 4.5 8 6.94l2.44-2.44 1.06 1.06L9.06 8l2.44 2.44z"/></svg>'
      };
      const statusText = {
        success: 'Coherence Check Passed',
        warning: 'Coherence Check: ' + data.warnings + ' warning(s)',
        error: 'Coherence Check Failed: ' + data.errors + ' error(s)'
      };

      // Create ripple panel element
      const rippleEl = document.createElement('div');
      rippleEl.className = 'ripple-panel ' + status;
      rippleEl.innerHTML = '<div class="ripple-header">' +
        statusIcons[status] +
        '<span>' + statusText[status] + '</span>' +
      '</div>' +
      (data.details && data.details.length > 0 ?
        '<div class="ripple-details">' +
          data.details.map(d =>
            '<div class="ripple-item ' + (d.type === 'error' ? 'fail' : 'pass') + '">' +
              (d.type === 'error' ? '✗' : '✓') + ' ' + d.message +
            '</div>'
          ).join('') +
        '</div>' : '');

      // Add to messages
      messagesEl.appendChild(rippleEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      // Auto-remove success messages after 5 seconds
      if (status === 'success') {
        setTimeout(() => {
          rippleEl.style.opacity = '0';
          rippleEl.style.transition = 'opacity 0.3s ease';
          setTimeout(() => rippleEl.remove(), 300);
        }, 5000);
      }
    }

    function updateSessionTime() {
      // Calculate total elapsed and active time
      const totalElapsed = Date.now() - sessionStats.startTime;

      // If user is currently active, add time since last activity to active time
      let displayActiveTime = sessionStats.activeTime;
      if (sessionStats.isActive) {
        displayActiveTime += Math.min(Date.now() - sessionStats.lastActivity, IDLE_THRESHOLD);
      }

      const activeMinutes = Math.floor(displayActiveTime / 60000);
      const activeHours = Math.floor(activeMinutes / 60);

      // Show active time (billable) vs total elapsed
      const activeDisplay = activeHours > 0
        ? activeHours + 'h ' + (activeMinutes % 60) + 'm'
        : activeMinutes + 'm';

      if (statTimeEl) {
        statTimeEl.textContent = activeDisplay;
        statTimeEl.title = sessionStats.isActive ? 'Active time (billable)' : 'Timer paused (idle)';
      }
    }

    function updateSessionStats(usage) {
      recordActivity(); // Mark activity when we get a response

      if (usage) {
        sessionStats.requests += 1;
        sessionStats.tokens += usage.totalTokens || 0;
        sessionStats.cost += usage.estimatedCost || 0;
      }
      if (statRequestsEl) statRequestsEl.textContent = sessionStats.requests;
      if (statTokensEl) statTokensEl.textContent = sessionStats.tokens.toLocaleString();
      if (statCostEl) statCostEl.textContent = '$' + sessionStats.cost.toFixed(4);
      updateSessionTime();

      // Log time to project (async, non-blocking)
      vscode.postMessage({
        type: 'logProjectTime',
        activeTime: sessionStats.activeTime,
        totalCost: sessionStats.cost,
        requests: sessionStats.requests,
        tokens: sessionStats.tokens
      });
    }

    function resetSessionStats() {
      // Save final time before reset
      vscode.postMessage({
        type: 'logProjectTime',
        activeTime: sessionStats.activeTime,
        totalCost: sessionStats.cost,
        requests: sessionStats.requests,
        tokens: sessionStats.tokens,
        isSessionEnd: true
      });

      sessionStats = {
        requests: 0,
        tokens: 0,
        cost: 0,
        startTime: Date.now(),
        activeTime: 0,
        lastActivity: Date.now(),
        isActive: true
      };
      updateSessionStats(null);
      vscode.postMessage({ type: 'resetSessionStats' });
    }

    if (resetStatsBtn) {
      resetStatsBtn.addEventListener('click', resetSessionStats);
    }

    // Voice input using Web Speech API
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    let recognition = null;
    let isListening = false;

    // Initialize speech recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        if (voiceBtn) {
          voiceBtn.classList.add('listening');
          voiceBtn.textContent = '🔴';
        }
        if (voiceStatus) {
          voiceStatus.textContent = 'Listening...';
          voiceStatus.classList.add('show');
        }
      };

      recognition.onend = () => {
        isListening = false;
        if (voiceBtn) {
          voiceBtn.classList.remove('listening');
          voiceBtn.textContent = '🎤';
        }
        if (voiceStatus) {
          voiceStatus.classList.remove('show');
        }
      };

      recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        // Show interim results in input
        if (!isFinal) {
          if (inputEl) inputEl.value = transcript;
          if (voiceStatus) voiceStatus.textContent = 'Listening: ' + transcript.substring(0, 30) + '...';
        } else {
          // Final result - put in input and optionally send
          if (inputEl) {
            inputEl.value = transcript;
            // Auto-resize textarea
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
          }
          if (voiceStatus) voiceStatus.textContent = 'Got: ' + transcript.substring(0, 30) + (transcript.length > 30 ? '...' : '');

          // Auto-send after brief delay (user can cancel by clicking elsewhere)
          setTimeout(() => {
            if (inputEl && inputEl.value === transcript && transcript.trim()) {
              sendMessage();
            }
          }, 500);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        if (voiceBtn) {
          voiceBtn.classList.remove('listening');
          voiceBtn.textContent = '🎤';
        }

        if (voiceStatus) {
          if (event.error === 'not-allowed') {
            voiceStatus.textContent = 'Microphone access denied';
          } else if (event.error === 'no-speech') {
            voiceStatus.textContent = 'No speech detected';
          } else {
            voiceStatus.textContent = 'Error: ' + event.error;
          }
          setTimeout(() => voiceStatus.classList.remove('show'), 2000);
        }
      };
    } else {
      // Speech recognition not supported
      if (voiceBtn) voiceBtn.style.display = 'none';
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (!recognition) {
          if (voiceStatus) {
            voiceStatus.textContent = 'Voice not supported in this environment';
            voiceStatus.classList.add('show');
            setTimeout(() => voiceStatus.classList.remove('show'), 2000);
          }
          return;
        }

        if (isListening) {
          recognition.stop();
        } else {
          try {
            recognition.start();
          } catch (e) {
            // Already started
            recognition.stop();
          }
        }
      });
    }

    // Shared voice input function for canvas mode
    function startVoiceInput() {
      if (!recognition) {
        showNotification('Voice input not supported in this browser');
        return;
      }

      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          recognition.stop();
        }
      }
    }

    // Team Notes functionality
    const teamNotesInput = document.getElementById('teamNotesInput');
    const saveTeamNotesBtn = document.getElementById('saveTeamNotesBtn');

    // Load team notes on startup
    vscode.postMessage({ type: 'loadTeamNotes' });

    if (saveTeamNotesBtn && teamNotesInput) {
      saveTeamNotesBtn.addEventListener('click', () => {
        const notes = teamNotesInput.value;
        vscode.postMessage({ type: 'saveTeamNotes', notes });
        saveTeamNotesBtn.textContent = 'Saved ✓';
        setTimeout(() => {
          saveTeamNotesBtn.textContent = 'Save';
        }, 1500);
      });
    }

    // Auto-save on blur
    if (teamNotesInput) {
      teamNotesInput.addEventListener('blur', () => {
        const notes = teamNotesInput.value;
        if (notes.trim()) {
          vscode.postMessage({ type: 'saveTeamNotes', notes });
        }
      });
    }

    // Command history for up/down navigation
    let commandHistory = JSON.parse(localStorage.getItem('codebakers-history') || '[]');
    let historyIndex = -1;
    let tempInput = ''; // Store current input when navigating

    function sendMessage() {
      console.log('CodeBakers: sendMessage() called');
      const message = inputEl.value.trim();
      console.log('CodeBakers: message =', message, 'isStreaming =', isStreaming);
      if (message) {
        // Add to history (avoid duplicates of last command)
        if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== message) {
          commandHistory.push(message);
          // Keep only last 50 commands
          if (commandHistory.length > 50) {
            commandHistory = commandHistory.slice(-50);
          }
          localStorage.setItem('codebakers-history', JSON.stringify(commandHistory));
        }
        historyIndex = -1;
        tempInput = '';
      }
      if (!message || isStreaming) {
        console.log('CodeBakers: sendMessage() blocked - message empty or isStreaming');
        return;
      }

      // Send all messages directly (pre-flight check removed)
      console.log('CodeBakers: sendMessage() proceeding with message');
      actualSendMessage(message);
    }

    function actualSendMessage(message) {
      console.log('CodeBakers: actualSendMessage() posting to extension');

      // Include uploaded files context in the message
      const filesContext = getUploadedFilesContext();
      const fullMessage = filesContext ? message + filesContext : message;

      vscode.postMessage({ type: 'sendMessage', message: fullMessage });
      inputEl.value = '';
      inputEl.style.height = 'auto';
      setStreamingState(true);
      startBuildingAnimation();

      // Clear uploaded files after sending (they're now part of the message)
      if (uploadedContextFiles.length > 0) {
        uploadedContextFiles = [];
        renderUploadedFiles();
      }
    }

    function cancelRequest() {
      vscode.postMessage({ type: 'cancelRequest' });
    }

    let buildingAnimationActive = false;

    function setStreamingState(streaming) {
      // CRITICAL: Set the state variable FIRST before any UI code that might throw
      isStreaming = streaming;
      console.log('CodeBakers: setStreamingState called with', streaming, '- isStreaming now:', isStreaming);

      // UI updates with null checks - these must not block state change
      try {
        if (sendBtn) sendBtn.style.display = streaming ? 'none' : 'block';
        if (cancelBtn) cancelBtn.classList.toggle('show', streaming);
        if (inputEl) inputEl.disabled = streaming;
        if (streamingEl) streamingEl.classList.toggle('show', streaming);

        // Start/stop tip cycling
        if (streaming) {
          startTipCycling();
        } else {
          stopTipCycling();
        }

        if (streaming && streamingContentEl) {
          streamingContentEl.style.display = 'none';
          streamingContentEl.innerHTML = '';
        }
      } catch (e) {
        console.error('CodeBakers: Error in setStreamingState UI update:', e);
      }
      // Note: Building animation is now controlled separately, not by streaming state
    }

    function startBuildingAnimation() {
      console.log('CodeBakers: startBuildingAnimation called');
      buildingAnimationActive = true;
      showBuildingAnimation();
    }

    function stopBuildingAnimation() {
      console.log('CodeBakers: stopBuildingAnimation called');
      buildingAnimationActive = false;
      hideBuildingAnimation();
    }

    function quickAction(command) {
      // Handle deploy directly without going through chat
      if (command === '/deploy') {
        vscode.postMessage({ type: 'deploy' });
        return;
      }
      // Handle git push directly
      if (command === '/git-push') {
        vscode.postMessage({ type: 'gitPush' });
        return;
      }
      // Handle mind map directly
      if (command === '/mindmap') {
        vscode.postMessage({ type: 'openMindMap' });
        return;
      }
      // Handle preview in browser
      if (command === '/preview') {
        vscode.postMessage({ type: 'openPreview', port: 3000 });
        return;
      }
      inputEl.value = command + ' ';
      inputEl.focus();
    }

    function clearChat() {
      vscode.postMessage({ type: 'clearChat' });
    }

    function login() {
      vscode.postMessage({ type: 'login' });
    }

    function closePendingPanel() {
      const pendingPanel = document.getElementById('pendingPanel');
      if (pendingPanel) {
        pendingPanel.classList.remove('show');
      }
    }

    function acceptAll() {
      vscode.postMessage({ type: 'applyAllFiles' });
      closePendingPanel();
    }

    function rejectAll() {
      vscode.postMessage({ type: 'rejectAllFiles' });
      closePendingPanel();
    }

    function acceptFile(id) {
      vscode.postMessage({ type: 'applyFile', id });
    }

    function rejectFile(id) {
      vscode.postMessage({ type: 'rejectFile', id });
    }

    function showDiff(id) {
      vscode.postMessage({ type: 'showDiff', id });
    }

    function undoFile(id) {
      vscode.postMessage({ type: 'undoFile', id });
    }

    function runCommand(id) {
      vscode.postMessage({ type: 'runCommand', id });
    }

    // =====================================
    // Canvas Mode Functions
    // =====================================

    function setViewMode(mode) {
      isCanvasMode = (mode === 'canvas');

      // Update body class
      document.body.classList.toggle('canvas-mode', isCanvasMode);

      // Update toggle button states
      if (canvasModeBtn && classicModeBtn) {
        canvasModeBtn.classList.toggle('active', isCanvasMode);
        classicModeBtn.classList.toggle('active', !isCanvasMode);
      }

      // In canvas mode, always show preview and hide classic chat elements
      if (splitContainer) {
        splitContainer.classList.toggle('preview-active', true); // Always show preview in canvas mode
      }

      console.log('CodeBakers: View mode set to', mode);
    }

    function openPendingSlideout() {
      if (pendingSlideout && pendingOverlay) {
        pendingOverlay.classList.add('show');
        pendingSlideout.classList.add('open');
        renderPendingSlideoutContent();
      }
    }

    function closePendingSlideout() {
      if (pendingSlideout && pendingOverlay) {
        pendingOverlay.classList.remove('show');
        pendingSlideout.classList.remove('open');
      }
    }

    function renderPendingSlideoutContent() {
      if (!pendingSlideoutContent) return;

      const pendingFiles = currentChanges.filter(c => c.status === 'pending');

      if (pendingFiles.length === 0) {
        pendingSlideoutContent.innerHTML = '<div class="pending-empty">No pending changes</div>';
        return;
      }

      pendingSlideoutContent.innerHTML = pendingFiles.map(change => {
        const fileName = change.operation.filePath.split('/').pop() || change.operation.filePath.split('\\\\').pop();
        const opIcon = change.operation.operation === 'create' ? '✨' :
                       change.operation.operation === 'delete' ? '🗑️' : '📝';

        return '<div class="pending-file-item">' +
          '<div class="pending-file-info">' +
            '<span class="pending-file-icon">' + opIcon + '</span>' +
            '<span class="pending-file-name">' + fileName + '</span>' +
          '</div>' +
          '<div class="pending-file-actions">' +
            '<button class="pending-item-btn diff" data-action="diff" data-id="' + change.id + '">Diff</button>' +
            '<button class="pending-item-btn accept" data-action="accept" data-id="' + change.id + '">✓</button>' +
            '<button class="pending-item-btn reject" data-action="reject" data-id="' + change.id + '">✕</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function updatePendingBadge() {
      const pendingCount = currentChanges.filter(c => c.status === 'pending').length;

      if (pendingBadge && pendingBadgeCount) {
        pendingBadgeCount.textContent = pendingCount;
        pendingBadge.classList.toggle('has-pending', pendingCount > 0);
      }

      if (pendingSlideoutCount) {
        pendingSlideoutCount.textContent = pendingCount;
      }
    }

    function toggleAIResponseBar() {
      aiResponseExpanded = !aiResponseExpanded;

      if (aiResponseBar) {
        aiResponseBar.classList.toggle('expanded', aiResponseExpanded);
      }

      if (aiResponseToggle) {
        aiResponseToggle.textContent = aiResponseExpanded ? '▼' : '▲';
      }
    }

    function updateAIResponseBar(status, summary, fullText) {
      if (aiResponseStatus) {
        aiResponseStatus.textContent = status || 'Ready';
      }

      if (aiResponseSummary) {
        aiResponseSummary.textContent = summary || 'Click to expand details';
      }

      if (aiResponseText) {
        aiResponseText.innerHTML = fullText || '';
      }

      // Manage visibility classes
      if (aiResponseBar) {
        const isReady = status === 'Ready' || !status;
        const isProcessing = status === 'Processing...' || status === 'Generating...';
        const hasContent = fullText && fullText.length > 0;

        // Hide when just showing "Ready" with no content
        aiResponseBar.classList.toggle('ready', isReady && !hasContent);
        // Show when actively processing or has content to display
        aiResponseBar.classList.toggle('active', isProcessing || hasContent);
        // Show pulsing dot when processing
        aiResponseBar.classList.toggle('processing', isProcessing);
      }
    }

    function sendCanvasMessage() {
      if (!canvasInput) return;

      const message = canvasInput.value.trim();
      if (!message || isStreaming) return;

      // Add selected node context if any
      let fullMessage = message;
      if (selectedNodeId) {
        const selectedNode = previewNodesData.find(n => n.id === selectedNodeId);
        if (selectedNode) {
          fullMessage = '[Context: ' + selectedNode.type + ' - ' + selectedNode.name + '] ' + message;
        }
      }

      // Clear input and send
      canvasInput.value = '';
      autoResize(canvasInput);

      // Use the same message sending logic as classic mode
      setStreamingState(true);
      updateAIResponseBar('Processing...', 'Working on your request...', '');
      vscode.postMessage({ type: 'sendMessage', message: fullMessage });
    }

    function handleCanvasAction(action) {
      if (!selectedNodeId && action !== 'add-feature') {
        // No node selected, prompt user
        if (canvasInput) {
          canvasInput.focus();
          canvasInput.placeholder = 'Select a node first, or describe what you want to add...';
        }
        return;
      }

      const selectedNode = previewNodesData.find(n => n.id === selectedNodeId);
      let prompt = '';

      switch (action) {
        case 'explain':
          prompt = selectedNode ?
            'Explain the ' + selectedNode.type + ' "' + selectedNode.name + '" - what does it do and how does it work?' : '';
          break;
        case 'add-feature':
          prompt = 'Add a new feature: ';
          if (canvasInput) {
            canvasInput.value = prompt;
            canvasInput.focus();
            canvasInput.setSelectionRange(prompt.length, prompt.length);
          }
          return;
        case 'connect':
          prompt = selectedNode ?
            'What should ' + selectedNode.name + ' connect to? Suggest connections and relationships.' : '';
          break;
        case 'generate':
          prompt = selectedNode ?
            'Generate the code for ' + selectedNode.type + ' "' + selectedNode.name + '"' : '';
          break;
      }

      if (prompt && canvasInput) {
        canvasInput.value = prompt;
        sendCanvasMessage();
      }
    }

    function selectNode(nodeId) {
      // Deselect previous
      if (selectedNodeId) {
        const prevNode = document.querySelector('.preview-node[data-node-id="' + selectedNodeId + '"]');
        if (prevNode) prevNode.classList.remove('selected');
      }

      // Select new
      selectedNodeId = nodeId;

      if (nodeId) {
        const newNode = document.querySelector('.preview-node[data-node-id="' + nodeId + '"]');
        if (newNode) newNode.classList.add('selected');

        // Update canvas input context
        const nodeData = previewNodesData.find(n => n.id === nodeId);
        if (nodeData && canvasInputContext) {
          canvasInputContext.innerHTML =
            '<div class="context-chip">' +
              '<span class="context-icon">' + (NODE_INFO[nodeData.type]?.icon || '📦') + '</span>' +
              '<span class="context-name">' + nodeData.name + '</span>' +
              '<button class="context-clear" onclick="selectNode(null)">×</button>' +
            '</div>';
          canvasInputContext.classList.add('has-context');
        }
      } else {
        if (canvasInputContext) {
          canvasInputContext.innerHTML = '';
          canvasInputContext.classList.remove('has-context');
        }
      }
    }

    // Make selectNode available globally for onclick handlers
    window.selectNode = selectNode;

    // =====================================
    // Live Preview Functions
    // =====================================

    function togglePreview() {
      previewEnabled = !previewEnabled;
      previewToggleBtn.classList.toggle('active', previewEnabled);
      splitContainer.classList.toggle('preview-active', previewEnabled);
    }

    function showBuildingAnimation() {
      console.log('CodeBakers: showBuildingAnimation called, previewEnabled:', previewEnabled);
      if (!previewEnabled) return;
      if (!buildingOverlay) {
        console.error('CodeBakers: buildingOverlay element not found!');
        return;
      }
      buildingOverlay.classList.add('active');
      previewEmpty.style.display = 'none';
      console.log('CodeBakers: Building animation shown');
    }

    function hideBuildingAnimation() {
      console.log('CodeBakers: hideBuildingAnimation called');
      if (!previewEnabled) return;
      if (buildingOverlay) {
        buildingOverlay.classList.remove('active');
      }
    }

    // Node type colors and descriptions (plain English for beginners)
    const NODE_INFO = {
      page: {
        icon: '📄',
        label: 'Page',
        description: 'A screen users can visit. Like the homepage, login page, or dashboard. Each page has its own URL.'
      },
      component: {
        icon: '🧩',
        label: 'Component',
        description: 'A reusable building block for your pages. Like a button, card, or navigation bar. Build once, use anywhere.'
      },
      api: {
        icon: '🔌',
        label: 'API Endpoint',
        description: 'A backend endpoint that handles data. When users submit a form, log in, or load data, an API handles it.'
      },
      database: {
        icon: '🗄️',
        label: 'Database Table',
        description: 'A table to store your data permanently. Like a spreadsheet that saves users, orders, or posts.'
      },
      type: {
        icon: '📝',
        label: 'Type Definition',
        description: 'A blueprint that defines the shape of your data. Like saying "a User has a name, email, and age".'
      },
      hook: {
        icon: '🪝',
        label: 'React Hook',
        description: 'Reusable logic for your components. Like "fetch user data" or "track form input". Write once, use anywhere.'
      },
      service: {
        icon: '⚙️',
        label: 'Service',
        description: 'A helper module that does a specific job. Like sending emails, processing payments, or talking to external services.'
      },
      middleware: {
        icon: '🔀',
        label: 'Middleware',
        description: 'A security checkpoint that runs before pages load. Checks if users are logged in or have permission.'
      },
      context: {
        icon: '🌐',
        label: 'Context Provider',
        description: 'Shared data that many components can access. Like the current user or theme. No need to pass it manually.'
      },
      action: {
        icon: '⚡',
        label: 'Server Action',
        description: 'A function that runs on the server when users submit forms. Handles creating, updating, or deleting data securely.'
      },
      job: {
        icon: '⏰',
        label: 'Background Job',
        description: 'A task that runs automatically in the background. Like sending weekly emails or cleaning up old data.'
      }
    };

    // Section order for vertical cascade (top to bottom)
    const SECTION_ORDER = [
      { type: 'page', title: 'Pages' },
      { type: 'component', title: 'Components' },
      { type: 'api', title: 'API Endpoints' },
      { type: 'service', title: 'Services' },
      { type: 'hook', title: 'Hooks' },
      { type: 'context', title: 'Context' },
      { type: 'middleware', title: 'Middleware' },
      { type: 'action', title: 'Actions' },
      { type: 'type', title: 'Types' },
      { type: 'database', title: 'Database' },
      { type: 'job', title: 'Background Jobs' }
    ];

    // Convert camelCase/PascalCase to readable text
    function humanize(name) {
      if (!name) return '';
      // Handle special cases
      if (name === 'api' || name === 'API') return 'API';
      if (name === 'cta' || name === 'CTA') return 'Call to Action';
      // Insert space before capitals, then clean up
      return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // HTTPServer -> HTTP Server
        .replace(/[-_]/g, ' ')  // snake_case and kebab-case
        .replace(/\\s+/g, ' ')  // multiple spaces
        .trim();
    }

    // Tooltip element (with null checks)
    const previewTooltip = document.getElementById('previewTooltip');
    const tooltipTitle = previewTooltip ? previewTooltip.querySelector('.preview-tooltip-title') : null;
    const tooltipDesc = previewTooltip ? previewTooltip.querySelector('.preview-tooltip-desc') : null;

    function showTooltip(nodeEl, nodeType, nodeName) {
      if (!previewTooltip || !tooltipTitle || !tooltipDesc) return;
      const info = NODE_INFO[nodeType] || NODE_INFO.component;
      tooltipTitle.textContent = info.label + ': ' + humanize(nodeName);
      tooltipDesc.textContent = info.description;

      const rect = nodeEl.getBoundingClientRect();

      // Position tooltip above the node, or below if not enough space
      let top = rect.top - 10;
      let left = rect.left + (rect.width / 2);

      previewTooltip.style.left = left + 'px';
      previewTooltip.style.top = top + 'px';
      previewTooltip.style.transform = 'translate(-50%, -100%)';

      // If tooltip would go off top of screen, show below instead
      if (top - 80 < 0) {
        previewTooltip.style.top = (rect.bottom + 10) + 'px';
        previewTooltip.style.transform = 'translate(-50%, 0)';
      }

      previewTooltip.classList.add('visible');
    }

    function hideTooltip() {
      if (previewTooltip) previewTooltip.classList.remove('visible');
    }

    // Health status analyzer for nodes
    function getNodeHealthStatus(node) {
      const indicators = [];

      // Check for common architectural issues based on node type
      if (node.type === 'api') {
        // APIs should have auth considerations
        indicators.push({
          level: 'warning',
          message: 'Consider adding authentication'
        });
      }

      if (node.type === 'page' && !node.name.toLowerCase().includes('error')) {
        // Pages should have error handling
        indicators.push({
          level: 'warning',
          message: 'Add error boundary'
        });
      }

      if (node.type === 'database') {
        // Databases need validation
        indicators.push({
          level: 'success',
          message: 'Schema defined'
        });
      }

      return { indicators };
    }

    // Generate code for a specific node
    function generateCodeForNode(node) {
      const nodeType = node.type;
      const nodeName = node.name;

      // Construct a generation prompt
      let prompt = '';
      switch (nodeType) {
        case 'page':
          prompt = 'Generate the code for the ' + nodeName + ' page with proper layout, loading states, and error handling.';
          break;
        case 'component':
          prompt = 'Generate the ' + nodeName + ' React component with TypeScript, proper props interface, and accessibility attributes.';
          break;
        case 'api':
          prompt = 'Generate the ' + nodeName + ' API route with input validation, error handling, and proper HTTP responses.';
          break;
        case 'database':
          prompt = 'Generate the Drizzle schema for the ' + nodeName + ' table with proper types and relations.';
          break;
        case 'hook':
          prompt = 'Generate the ' + nodeName + ' custom React hook with proper TypeScript types and error handling.';
          break;
        case 'service':
          prompt = 'Generate the ' + nodeName + ' service module with proper error handling and type safety.';
          break;
        default:
          prompt = 'Generate the code for ' + nodeName + ' (' + nodeType + ') following best practices.';
      }

      // Fill the input and trigger send
      if (inputEl) {
        inputEl.value = prompt;
        autoResize(inputEl);
        inputEl.focus();

        // Optionally auto-send
        // sendMessage();
      }

      // Show feedback
      showNotification('Ready to generate ' + nodeName + ' - press Enter to send');
    }

    // Simple notification helper
    function showNotification(message) {
      const existing = document.querySelector('.canvas-notification');
      if (existing) existing.remove();

      const notif = document.createElement('div');
      notif.className = 'canvas-notification';
      notif.textContent = message;
      notif.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 8px 16px; border-radius: 6px; font-size: 12px; z-index: 1000; animation: fadeInUp 0.3s ease;';

      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);
    }

    // Analyze architecture and suggest missing pieces
    function analyzeMissingPieces(nodes) {
      const suggestions = [];
      const nodeTypes = nodes.map(n => n.type);
      const nodeNames = nodes.map(n => n.name.toLowerCase());

      // Common patterns to suggest
      const patterns = [
        {
          condition: () => nodeTypes.includes('page') && !nodeTypes.includes('component'),
          suggestion: { type: 'component', name: 'Navigation', icon: '🧩', reason: 'Pages typically need a navigation component' }
        },
        {
          condition: () => nodeTypes.includes('page') && !nodeNames.some(n => n.includes('error') || n.includes('404')),
          suggestion: { type: 'page', name: 'ErrorPage', icon: '📄', reason: 'Add error handling for better UX' }
        },
        {
          condition: () => nodeTypes.includes('api') && !nodeTypes.includes('type'),
          suggestion: { type: 'type', name: 'ApiTypes', icon: '📝', reason: 'Define types for API request/response' }
        },
        {
          condition: () => nodeTypes.includes('component') && !nodeTypes.includes('hook') && nodes.length > 3,
          suggestion: { type: 'hook', name: 'useData', icon: '🪝', reason: 'Extract shared logic into a custom hook' }
        },
        {
          condition: () => nodeTypes.includes('database') && !nodeTypes.includes('api'),
          suggestion: { type: 'api', name: 'DataApi', icon: '🔌', reason: 'Add API routes to access your database' }
        },
        {
          condition: () => nodeTypes.includes('page') && !nodeNames.some(n => n.includes('loading')),
          suggestion: { type: 'component', name: 'LoadingSpinner', icon: '🧩', reason: 'Add loading states for better UX' }
        },
        {
          condition: () => nodes.length > 0 && !nodeTypes.includes('service') && nodeTypes.includes('api'),
          suggestion: { type: 'service', name: 'ApiClient', icon: '⚙️', reason: 'Centralize API calls in a service' }
        }
      ];

      patterns.forEach(p => {
        if (p.condition()) {
          suggestions.push(p.suggestion);
        }
      });

      return suggestions.slice(0, 4); // Max 4 suggestions
    }

    // Update suggestions panel
    function updateSuggestions() {
      const suggestionsPanel = document.getElementById('suggestionsPanel');
      const suggestionsList = document.getElementById('suggestionsList');

      if (!suggestionsPanel || !suggestionsList) return;

      const suggestions = analyzeMissingPieces(previewNodesData);

      if (suggestions.length === 0) {
        suggestionsPanel.classList.remove('visible');
        return;
      }

      suggestionsList.innerHTML = suggestions.map(s =>
        '<div class="suggestion-item" data-type="' + s.type + '" data-name="' + s.name + '">' +
          '<span class="suggestion-icon">' + s.icon + '</span>' +
          '<div class="suggestion-content">' +
            '<div class="suggestion-name">' + s.name + '</div>' +
            '<div class="suggestion-reason">' + s.reason + '</div>' +
          '</div>' +
          '<span class="suggestion-add">+</span>' +
        '</div>'
      ).join('');

      // Add click handlers
      suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', function() {
          const type = this.dataset.type;
          const name = this.dataset.name;
          addSuggestedNode(type, name);
        });
      });

      suggestionsPanel.classList.add('visible');
    }

    // Add a suggested node
    function addSuggestedNode(type, name) {
      const prompt = 'Add a ' + type + ' called ' + name + ' to the architecture';

      if (inputEl) {
        inputEl.value = prompt;
        autoResize(inputEl);
        inputEl.focus();
      }

      showNotification('Adding ' + name + ' - press Enter to confirm');
    }

    // Edge click handler for "Why This?" explanations
    function getEdgeExplanation(edgeType, sourceName, targetName) {
      const explanations = {
        'renders': {
          title: 'Component Composition',
          desc: sourceName + ' renders ' + targetName + ' as part of its UI. This is React\\'s core pattern - building UIs from smaller, reusable pieces. The parent controls when and how the child appears.'
        },
        'calls': {
          title: 'API Communication',
          desc: sourceName + ' calls ' + targetName + ' to fetch or send data. This keeps your UI (frontend) separate from your data logic (backend) - a key principle for maintainable apps.'
        },
        'uses': {
          title: 'Hook Dependency',
          desc: sourceName + ' uses ' + targetName + ' to share logic. Hooks let you reuse stateful behavior without changing your component hierarchy.'
        },
        'queries': {
          title: 'Database Query',
          desc: sourceName + ' queries ' + targetName + ' to read data. This is how your app retrieves stored information.'
        },
        'default': {
          title: 'Connection',
          desc: sourceName + ' is connected to ' + targetName + '. This relationship helps organize your codebase.'
        }
      };

      return explanations[edgeType] || explanations['default'];
    }

    // Show edge explanation tooltip
    function showEdgeExplanation(edge, event) {
      const sourceNode = previewNodesData.find(n => n.id === edge.source);
      const targetNode = previewNodesData.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      const explanation = getEdgeExplanation(edge.type, sourceNode.name, targetNode.name);

      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'edge-explanation-tooltip';
      tooltip.innerHTML =
        '<div class="edge-explanation-title">💡 ' + explanation.title + '</div>' +
        '<div class="edge-explanation-desc">' + explanation.desc + '</div>';
      tooltip.style.cssText = 'position: fixed; left: ' + event.clientX + 'px; top: ' + (event.clientY - 10) + 'px; transform: translate(-50%, -100%); background: var(--vscode-editorHoverWidget-background, #252526); border: 1px solid var(--vscode-editorHoverWidget-border, #454545); border-radius: 8px; padding: 12px; max-width: 280px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 1000;';

      document.body.appendChild(tooltip);

      // Remove on click outside
      const removeTooltip = () => {
        tooltip.remove();
        document.removeEventListener('click', removeTooltip);
      };
      setTimeout(() => document.addEventListener('click', removeTooltip), 100);
    }

    // Initialize suggestions panel close button
    const suggestionsClose = document.getElementById('suggestionsClose');
    if (suggestionsClose) {
      suggestionsClose.addEventListener('click', function() {
        document.getElementById('suggestionsPanel').classList.remove('visible');
      });
    }

    // Initialize templates gallery
    const TEMPLATES = [
      {
        id: 'saas',
        icon: '🚀',
        name: 'SaaS Starter',
        desc: 'Auth, dashboard, settings, billing',
        nodes: [
          { type: 'page', name: 'HomePage' },
          { type: 'page', name: 'Dashboard' },
          { type: 'page', name: 'Settings' },
          { type: 'page', name: 'Login' },
          { type: 'component', name: 'Navigation' },
          { type: 'component', name: 'Sidebar' },
          { type: 'api', name: 'AuthApi' },
          { type: 'api', name: 'UserApi' },
          { type: 'database', name: 'Users' }
        ]
      },
      {
        id: 'landing',
        icon: '🎯',
        name: 'Landing Page',
        desc: 'Hero, features, pricing, CTA',
        nodes: [
          { type: 'page', name: 'LandingPage' },
          { type: 'component', name: 'Hero' },
          { type: 'component', name: 'Features' },
          { type: 'component', name: 'Pricing' },
          { type: 'component', name: 'Testimonials' },
          { type: 'component', name: 'CTA' },
          { type: 'component', name: 'Footer' }
        ]
      },
      {
        id: 'blog',
        icon: '📝',
        name: 'Blog',
        desc: 'Posts, categories, comments',
        nodes: [
          { type: 'page', name: 'BlogHome' },
          { type: 'page', name: 'PostPage' },
          { type: 'component', name: 'PostCard' },
          { type: 'component', name: 'CommentSection' },
          { type: 'api', name: 'PostsApi' },
          { type: 'database', name: 'Posts' },
          { type: 'database', name: 'Comments' }
        ]
      },
      {
        id: 'ecommerce',
        icon: '🛒',
        name: 'E-commerce',
        desc: 'Products, cart, checkout',
        nodes: [
          { type: 'page', name: 'ProductsPage' },
          { type: 'page', name: 'ProductDetail' },
          { type: 'page', name: 'CartPage' },
          { type: 'page', name: 'Checkout' },
          { type: 'component', name: 'ProductCard' },
          { type: 'component', name: 'CartItem' },
          { type: 'api', name: 'ProductsApi' },
          { type: 'api', name: 'OrdersApi' },
          { type: 'database', name: 'Products' },
          { type: 'database', name: 'Orders' }
        ]
      }
    ];

    // Render templates grid
    function renderTemplatesGallery() {
      const grid = document.getElementById('templatesGrid');
      if (!grid) return;

      grid.innerHTML = TEMPLATES.map(t =>
        '<div class="template-card" data-template-id="' + t.id + '">' +
          '<div class="template-icon">' + t.icon + '</div>' +
          '<div class="template-name">' + t.name + '</div>' +
          '<div class="template-desc">' + t.desc + '</div>' +
        '</div>'
      ).join('');

      // Add click handlers
      grid.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', function() {
          const templateId = this.dataset.templateId;
          applyTemplate(templateId);
        });
      });
    }

    // Apply a template
    function applyTemplate(templateId) {
      const template = TEMPLATES.find(t => t.id === templateId);
      if (!template) return;

      // Create nodes from template
      const nodes = template.nodes.map((n, i) => ({
        id: 'node_' + Date.now() + '_' + i,
        type: n.type,
        name: n.name,
        description: ''
      }));

      // Create edges (pages render components)
      const edges = [];
      const pages = nodes.filter(n => n.type === 'page');
      const components = nodes.filter(n => n.type === 'component');
      pages.forEach(page => {
        components.slice(0, 3).forEach(comp => {
          edges.push({
            id: 'edge_' + Date.now() + '_' + edges.length,
            source: page.id,
            target: comp.id,
            type: 'renders'
          });
        });
      });

      // Render
      renderPreviewNodes(nodes, edges);
      toggleTemplatesGallery();
      showNotification('Applied ' + template.name + ' template');
    }

    // Initialize templates close button
    const templatesClose = document.getElementById('templatesClose');
    if (templatesClose) {
      templatesClose.addEventListener('click', toggleTemplatesGallery);
    }

    // Render templates on load
    renderTemplatesGallery();

    // Update canvas stats
    function updateCanvasStats() {
      const pages = previewNodesData.filter(n => n.type === 'page').length;
      const components = previewNodesData.filter(n => n.type === 'component').length;
      const apis = previewNodesData.filter(n => n.type === 'api').length;

      const statPages = document.getElementById('statPages');
      const statComponents = document.getElementById('statComponents');
      const statApis = document.getElementById('statApis');

      if (statPages) statPages.textContent = pages;
      if (statComponents) statComponents.textContent = components;
      if (statApis) statApis.textContent = apis;
    }

    // Drag state
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };

    function renderPreviewNodes(nodes, edges) {
      console.log('CodeBakers: renderPreviewNodes called with', nodes.length, 'nodes and', edges.length, 'edges');
      if (!previewEnabled) return;

      previewNodesData = nodes || [];
      previewEdgesData = edges || [];

      // Clear existing
      previewNodes.innerHTML = '';
      previewEdges.innerHTML = ''; // Clear SVG edges

      if (previewNodesData.length === 0) {
        previewEmpty.style.display = 'flex';
        return;
      }

      previewEmpty.style.display = 'none';

      // Group nodes by type for vertical cascade
      const nodesByType = {};
      previewNodesData.forEach(node => {
        if (!nodesByType[node.type]) {
          nodesByType[node.type] = [];
        }
        nodesByType[node.type].push(node);
      });

      // Render sections in order (vertical cascade)
      let animationIndex = 0;
      SECTION_ORDER.forEach(section => {
        const sectionNodes = nodesByType[section.type];
        if (!sectionNodes || sectionNodes.length === 0) return;

        // Create section container
        const sectionEl = document.createElement('div');
        sectionEl.className = 'preview-section';

        // Section title
        const titleEl = document.createElement('div');
        titleEl.className = 'preview-section-title';
        titleEl.textContent = section.title;
        sectionEl.appendChild(titleEl);

        // Nodes container
        const nodesContainer = document.createElement('div');
        nodesContainer.className = 'preview-section-nodes';

        // Render each node
        sectionNodes.forEach(node => {
          const info = NODE_INFO[node.type] || NODE_INFO.component;
          const nodeEl = document.createElement('div');
          nodeEl.className = 'preview-node';
          nodeEl.dataset.type = node.type;
          nodeEl.dataset.nodeId = node.id;
          nodeEl.dataset.nodeName = node.name;
          nodeEl.style.animationDelay = (animationIndex * 80) + 'ms';

          // Plain English label with original name below
          const displayLabel = humanize(node.name);

          // Get health status for this node type
          const healthStatus = getNodeHealthStatus(node);
          const healthHtml = healthStatus.indicators.length > 0
            ? '<div class="node-health">' + healthStatus.indicators.map(h =>
                '<span class="health-indicator ' + h.level + '" title="' + escapeHtml(h.message) + '"></span>'
              ).join('') + '</div>'
            : '';

          nodeEl.innerHTML =
            '<div class="node-actions">' +
              '<button class="node-action-btn generate" title="Generate code for ' + escapeHtml(node.name) + '" data-action="generate">⚡</button>' +
            '</div>' +
            '<span class="node-icon">' + info.icon + '</span>' +
            '<span class="node-label">' + escapeHtml(displayLabel) + '</span>' +
            '<span class="node-name">' + escapeHtml(node.name) + '</span>' +
            healthHtml;

          // Handle action button clicks
          const generateBtn = nodeEl.querySelector('.node-action-btn.generate');
          if (generateBtn) {
            generateBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              generateCodeForNode(node);
            });
          }

          // Show as visible with stagger
          setTimeout(() => {
            nodeEl.classList.add('visible');
          }, animationIndex * 80);

          // Tooltip on hover
          nodeEl.addEventListener('mouseenter', function(e) {
            showTooltip(this, node.type, node.name);
          });
          nodeEl.addEventListener('mouseleave', hideTooltip);

          // Click to select (for canvas mode)
          nodeEl.addEventListener('click', function(e) {
            if (!draggedNode) { // Only select if not dragging
              selectNode(node.id);
            }
          });

          // Drag functionality
          nodeEl.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return; // Left click only
            draggedNode = this;
            const rect = this.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            this.classList.add('dragging');
            hideTooltip();
          });

          nodesContainer.appendChild(nodeEl);
          animationIndex++;
        });

        sectionEl.appendChild(nodesContainer);
        previewNodes.appendChild(sectionEl);
      });

      // Render connection lines after nodes are positioned
      renderPreviewEdges();

      // Update AI suggestions based on current architecture
      updateSuggestions();

      // Update stats display
      updateCanvasStats();
    }

    // Global drag handlers
    document.addEventListener('mousemove', function(e) {
      if (!draggedNode) return;
      // For now, just show visual feedback during drag
      // Full repositioning would require absolute positioning
    });

    document.addEventListener('mouseup', function(e) {
      if (draggedNode) {
        draggedNode.classList.remove('dragging');
        draggedNode = null;
      }
    });

    // Recalculate edges on resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        if (previewEdgesData.length > 0) {
          renderPreviewEdges();
        }
      }, 150);
    });

    function renderPreviewEdges() {
      const legend = document.getElementById('connectionLegend');

      if (!previewEdges || previewEdgesData.length === 0) {
        if (legend) legend.classList.remove('visible');
        return;
      }

      const canvasRect = previewCanvas.getBoundingClientRect();
      previewEdges.innerHTML = '';

      // Show legend when edges exist
      if (legend) legend.classList.add('visible');

      // Wait a bit for nodes to be rendered and positioned
      setTimeout(() => {
        previewEdgesData.forEach((edge, index) => {
          const sourceEl = document.querySelector('[data-node-id="' + edge.source + '"]');
          const targetEl = document.querySelector('[data-node-id="' + edge.target + '"]');

          if (!sourceEl || !targetEl) return;

          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          // Calculate positions relative to canvas
          const x1 = sourceRect.left + sourceRect.width / 2 - canvasRect.left;
          const y1 = sourceRect.bottom - canvasRect.top;
          const x2 = targetRect.left + targetRect.width / 2 - canvasRect.left;
          const y2 = targetRect.top - canvasRect.top;

          // Skip if source is below target (invalid connection direction)
          if (y1 > y2 + 20) return;

          // Create curved path (vertical bezier)
          const midY = (y1 + y2) / 2;
          const controlOffset = Math.min(Math.abs(y2 - y1) * 0.4, 50);

          const pathD = 'M ' + x1 + ' ' + y1 +
                       ' C ' + x1 + ' ' + (y1 + controlOffset) +
                       ', ' + x2 + ' ' + (y2 - controlOffset) +
                       ', ' + x2 + ' ' + y2;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', pathD);
          path.setAttribute('class', 'preview-edge ' + (edge.type || 'default'));
          path.setAttribute('data-edge-id', edge.id);
          path.style.cursor = 'pointer';
          path.style.pointerEvents = 'stroke';

          // Click handler for "Why This?" explanation
          path.addEventListener('click', function(e) {
            e.stopPropagation();
            showEdgeExplanation(edge, e);
          });

          // Staggered animation
          setTimeout(() => {
            path.classList.add('visible');
          }, index * 100 + 300);

          previewEdges.appendChild(path);

          // Add small dots at connection points
          const dotStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dotStart.setAttribute('cx', x1);
          dotStart.setAttribute('cy', y1);
          dotStart.setAttribute('r', '3');
          dotStart.setAttribute('class', 'edge-dot ' + (edge.type || 'default'));
          setTimeout(() => dotStart.classList.add('visible'), index * 100 + 400);
          previewEdges.appendChild(dotStart);

          const dotEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dotEnd.setAttribute('cx', x2);
          dotEnd.setAttribute('cy', y2);
          dotEnd.setAttribute('r', '3');
          dotEnd.setAttribute('class', 'edge-dot ' + (edge.type || 'default'));
          setTimeout(() => dotEnd.classList.add('visible'), index * 100 + 400);
          previewEdges.appendChild(dotEnd);
        });
      }, 100);
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Show toast notification for auto-applied files
    function showToast(message, action, files) {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = \`
        <span class="toast-icon">✅</span>
        <span class="toast-message">\${escapeHtml(message)}</span>
        \${action === 'undo' ? '<button class="toast-undo-btn">Undo</button>' : ''}
      \`;

      // Handle undo click
      const undoBtn = toast.querySelector('.toast-undo-btn');
      if (undoBtn && files) {
        undoBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'undoAppliedFiles', files: files });
          toast.remove();
        });
      }

      container.appendChild(toast);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }

    // Parse AI response for architecture suggestions
    function parseArchitectureFromResponse(content) {
      console.log('CodeBakers: parseArchitectureFromResponse called, content length:', content?.length);
      const nodes = [];
      const edges = [];
      const addedNames = new Set();

      function addNode(type, name, description = '') {
        const normalizedName = name.toLowerCase();
        if (!addedNames.has(normalizedName) && name.length > 1) {
          addedNames.add(normalizedName);
          nodes.push({
            id: 'node_' + Date.now() + '_' + nodes.length,
            type: type,
            name: name,
            description: description
          });
        }
      }

      // 1. Extract from file paths (most reliable)
      // Matches: src/app/page.tsx, src/components/Hero.tsx, app/api/auth/route.ts, etc.
      const filePathPattern = /(?:src\\/|app\\/|pages\\/|components\\/|lib\\/|hooks\\/|services\\/|types\\/|api\\/)([^/\\s]+(?:\\/[^/\\s]+)*)\\.(tsx?|jsx?)/gi;
      let match;
      while ((match = filePathPattern.exec(content)) !== null) {
        const filePath = match[1];
        const parts = filePath.split('/');
        const fileName = parts[parts.length - 1];

        // Determine type from path
        let type = 'component';
        const fullPath = match[0].toLowerCase();

        if (fullPath.includes('/api/') || fullPath.includes('route.ts')) {
          type = 'api';
        } else if (fullPath.includes('/app/') && (fileName === 'page' || fileName === 'layout')) {
          type = 'page';
        } else if (fullPath.includes('pages/') && !fullPath.includes('api')) {
          type = 'page';
        } else if (fullPath.includes('/hooks/') || fileName.startsWith('use')) {
          type = 'hook';
        } else if (fullPath.includes('/services/') || fullPath.includes('/lib/')) {
          type = 'service';
        } else if (fullPath.includes('/types/') || fileName.includes('type') || fileName.includes('interface')) {
          type = 'type';
        } else if (fullPath.includes('middleware')) {
          type = 'middleware';
        } else if (fullPath.includes('context') || fileName.includes('Context') || fileName.includes('Provider')) {
          type = 'context';
        }

        // Clean up the name
        let name = fileName.replace(/\\.(tsx?|jsx?)$/i, '');
        if (name === 'page' || name === 'layout' || name === 'route') {
          // Use the folder name instead
          name = parts.length > 1 ? parts[parts.length - 2] : name;
        }
        // Convert to PascalCase for display
        name = name.charAt(0).toUpperCase() + name.slice(1);

        addNode(type, name);
      }

      // 2. Look for component/page mentions in prose
      const prosePatterns = [
        /(?:creat|add|build|implement)(?:e|ing|ed|s)?\\s+(?:a|an|the)?\\s*([A-Z][a-zA-Z0-9]*(?:Page|Component|Form|Modal|Card|Button|Header|Footer|Nav|Sidebar|Section|Hero|List|Table|Grid|Layout|View|Screen|Panel|Widget|Bar|Menu|Dropdown|Input|Dialog))/g,
        /([A-Z][a-zA-Z0-9]*(?:Page|Component|Form|Modal|Card|Header|Footer|Nav|Sidebar|Section|Hero|Layout))\\s+(?:component|page)?/g
      ];

      prosePatterns.forEach(pattern => {
        let m;
        while ((m = pattern.exec(content)) !== null) {
          const name = m[1];
          let type = 'component';
          const lowerName = name.toLowerCase();
          if (lowerName.includes('page') || lowerName.includes('screen') || lowerName.includes('view')) {
            type = 'page';
          }
          addNode(type, name);
        }
      });

      // 3. Extract from code blocks - look for function/const exports
      const exportPattern = /export\\s+(?:default\\s+)?(?:function|const|class)\\s+([A-Z][a-zA-Z0-9]*)/g;
      while ((match = exportPattern.exec(content)) !== null) {
        const name = match[1];
        let type = 'component';
        const lowerName = name.toLowerCase();
        if (lowerName.includes('hook') || name.startsWith('use')) {
          type = 'hook';
        } else if (lowerName.includes('service') || lowerName.includes('client') || lowerName.includes('api')) {
          type = 'service';
        } else if (lowerName.includes('context') || lowerName.includes('provider')) {
          type = 'context';
        }
        addNode(type, name);
      }

      // 4. Look for database/schema mentions
      const dbPatterns = [
        /(?:table|schema|model|entity)(?:\\s+(?:for|called|named))?\\s+['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]?/gi,
        /createTable\\s*\\(\\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]?/g
      ];
      dbPatterns.forEach(pattern => {
        let m;
        while ((m = pattern.exec(content)) !== null) {
          addNode('database', m[1].charAt(0).toUpperCase() + m[1].slice(1));
        }
      });

      // 5. If we still have no nodes, try to detect from common landing page elements
      if (nodes.length === 0) {
        const landingPageKeywords = [
          { pattern: /hero\\s*(?:section|component|area)?/gi, name: 'Hero', type: 'component' },
          { pattern: /navigation|navbar|nav\\s*bar/gi, name: 'Navigation', type: 'component' },
          { pattern: /header/gi, name: 'Header', type: 'component' },
          { pattern: /footer/gi, name: 'Footer', type: 'component' },
          { pattern: /(?:feature|features)\\s*(?:section|list|grid)?/gi, name: 'Features', type: 'component' },
          { pattern: /(?:testimonial|testimonials)/gi, name: 'Testimonials', type: 'component' },
          { pattern: /(?:pricing|plans)/gi, name: 'Pricing', type: 'component' },
          { pattern: /(?:cta|call[\\s-]to[\\s-]action)/gi, name: 'CTA', type: 'component' },
          { pattern: /contact\\s*(?:form|section)?/gi, name: 'Contact', type: 'component' },
          { pattern: /landing\\s*page/gi, name: 'LandingPage', type: 'page' },
          { pattern: /home\\s*page/gi, name: 'HomePage', type: 'page' }
        ];

        landingPageKeywords.forEach(({ pattern, name, type }) => {
          if (pattern.test(content)) {
            addNode(type, name);
          }
        });
      }

      // Generate edges based on common patterns (pages render components)
      const pageNodes = nodes.filter(n => n.type === 'page');
      const componentNodes = nodes.filter(n => n.type === 'component');

      pageNodes.forEach(page => {
        componentNodes.forEach(comp => {
          edges.push({
            id: 'edge_' + Date.now() + '_' + edges.length,
            source: page.id,
            target: comp.id,
            type: 'renders'
          });
        });
      });

      console.log('CodeBakers: parseArchitectureFromResponse found', nodes.length, 'nodes,', edges.length, 'edges');
      if (nodes.length > 0) {
        console.log('CodeBakers: Nodes found:', nodes.map(n => n.type + ':' + n.name).join(', '));
      }
      return { nodes, edges };
    }

    // Preview toggle click handler
    if (previewToggleBtn) {
      previewToggleBtn.addEventListener('click', togglePreview);
    }

    // Initialize preview panel state (default: enabled)
    if (previewEnabled && splitContainer) {
      splitContainer.classList.add('preview-active');
    }

    function handleKeydown(e) {
      // Enter (without Shift) or Ctrl+Enter to send
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        return;
      }

      // Up arrow: Previous command in history
      if (e.key === 'ArrowUp' && commandHistory.length > 0) {
        e.preventDefault();
        if (historyIndex === -1) {
          tempInput = inputEl.value; // Save current input
          historyIndex = commandHistory.length - 1;
        } else if (historyIndex > 0) {
          historyIndex--;
        }
        inputEl.value = commandHistory[historyIndex];
        autoResize(inputEl);
        return;
      }

      // Down arrow: Next command in history
      if (e.key === 'ArrowDown' && historyIndex !== -1) {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          inputEl.value = commandHistory[historyIndex];
        } else {
          historyIndex = -1;
          inputEl.value = tempInput; // Restore saved input
        }
        autoResize(inputEl);
        return;
      }
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Skip if typing in any input or textarea
      const activeTag = document.activeElement?.tagName;
      const isTyping = document.activeElement === inputEl ||
                       document.activeElement === canvasInput ||
                       activeTag === 'INPUT' ||
                       activeTag === 'TEXTAREA';

      // Ctrl+Shift+A: Accept all pending changes
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        acceptAll();
        return;
      }

      // Escape: Close panels, deselect node, or cancel request (in priority order)
      if (e.key === 'Escape') {
        e.preventDefault();
        // First: Close templates gallery if open
        const templatesGallery = document.getElementById('templatesGallery');
        if (templatesGallery && templatesGallery.classList.contains('visible')) {
          templatesGallery.classList.remove('visible');
          return;
        }
        // Second: Close suggestions panel if open
        const suggestionsPanel = document.getElementById('suggestionsPanel');
        if (suggestionsPanel && suggestionsPanel.classList.contains('visible')) {
          suggestionsPanel.classList.remove('visible');
          return;
        }
        // Third: Deselect node if selected
        if (selectedNodeId) {
          selectNode(null);
          return;
        }
        // Fourth: Cancel any active request
        cancelRequest();
        return;
      }

      // Map Mode: Press C to switch to Chat mode
      if (!isTyping && document.body.classList.contains('canvas-mode')) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          setCanvasMode(false);
          return;
        }
      }

      // Ctrl+Enter anywhere: Focus input and send if has content
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        inputEl.focus();
        if (inputEl.value.trim()) {
          sendMessage();
        }
        return;
      }

      // / : Focus input (when not typing)
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        inputEl.focus();
        return;
      }
    });

    // Show add node palette
    function showAddNodePalette() {
      const nodeTypes = [
        { type: 'page', icon: '📄', name: 'Page' },
        { type: 'component', icon: '🧩', name: 'Component' },
        { type: 'api', icon: '🔌', name: 'API Route' },
        { type: 'database', icon: '🗄️', name: 'Database' },
        { type: 'hook', icon: '🪝', name: 'Hook' },
        { type: 'service', icon: '⚙️', name: 'Service' }
      ];

      const prompt = 'What would you like to add?\\n\\n' +
        nodeTypes.map((t, i) => (i + 1) + '. ' + t.icon + ' ' + t.name).join('\\n');

      if (inputEl) {
        inputEl.value = 'Add a ';
        inputEl.focus();
        autoResize(inputEl);
      }
      showNotification('Type: "Add a [page/component/api]..."');
    }

    // Delete selected node
    function deleteSelectedNode() {
      if (!selectedNodeId) return;

      const node = previewNodesData.find(n => n.id === selectedNodeId);
      if (!node) return;

      // Remove from data
      previewNodesData = previewNodesData.filter(n => n.id !== selectedNodeId);
      previewEdgesData = previewEdgesData.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);

      // Re-render
      renderPreviewNodes(previewNodesData, previewEdgesData);
      selectNode(null);
      showNotification('Removed ' + node.name);
    }

    // Toggle templates gallery
    function toggleTemplatesGallery() {
      const gallery = document.getElementById('templatesGallery');
      if (gallery) {
        gallery.classList.toggle('visible');
      }
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Clean up raw AI output - hide code generation, show summaries
    function cleanStreamContent(content) {
      if (!content) return '';
      let text = content;
      const nl = String.fromCharCode(10);

      // Detect if content is mostly code/JSX (should be hidden)
      function isMostlyCode(str) {
        // Count JSX-like tags (capitalized component names)
        const jsxTags = ['<Card', '<Button', '<Input', '<Form', '<Modal', '<Table', '<div', '<span', '<p>', '<h1', '<h2', '<h3', 'className=', 'onClick=', 'onChange=', 'import ', 'export ', 'function ', 'const ', 'return ('];
        let codeIndicators = 0;
        for (let i = 0; i < jsxTags.length; i++) {
          if (str.indexOf(jsxTags[i]) !== -1) codeIndicators++;
        }
        // If 3+ code indicators, it's mostly code
        return codeIndicators >= 3;
      }

      // Simple tag removal using indexOf/substring
      function removeTagBlock(str, openTag, closeTag) {
        let result = str;
        let safety = 0;
        while (result.indexOf(openTag) !== -1 && safety < 100) {
          const start = result.indexOf(openTag);
          const end = result.indexOf(closeTag, start);
          if (end === -1) break;
          result = result.substring(0, start) + result.substring(end + closeTag.length);
          safety++;
        }
        return result;
      }

      function removeTag(str, tag) {
        return str.split('<' + tag + '>').join('').split('</' + tag + '>').join('');
      }

      // Extract file operations for summary before removing
      const fileOps = [];
      let searchStart = 0;
      while (text.indexOf('<file_operation>', searchStart) !== -1) {
        const opStart = text.indexOf('<file_operation>', searchStart);
        const opEnd = text.indexOf('</file_operation>', opStart);
        if (opEnd === -1) break;
        const block = text.substring(opStart, opEnd);
        const actionStart = block.indexOf('<action>');
        const actionEnd = block.indexOf('</action>');
        const pathStart = block.indexOf('<path>');
        const pathEnd = block.indexOf('</path>');
        if (actionStart !== -1 && actionEnd !== -1 && pathStart !== -1 && pathEnd !== -1) {
          fileOps.push({
            action: block.substring(actionStart + 8, actionEnd),
            path: block.substring(pathStart + 6, pathEnd)
          });
        }
        searchStart = opEnd + 1;
      }

      // Remove file_operation blocks
      text = removeTagBlock(text, '<file_operation>', '</file_operation>');

      // Remove other internal tags
      text = removeTag(text, 'content');
      text = removeTag(text, 'action');
      text = removeTag(text, 'path');
      text = removeTag(text, 'thinking');
      text = removeTag(text, 'result');

      // If content is mostly code, replace with simple message
      if (isMostlyCode(text)) {
        let summary = '✨ Generating code...';
        if (fileOps.length > 0) {
          summary = fileOps.map(function(op) {
            return '📄 ' + op.action + ': ' + op.path;
          }).join(nl);
        }
        return summary;
      }

      // Add file operation summary at top if any were found
      if (fileOps.length > 0) {
        const summary = fileOps.map(function(op) {
          return '📄 ' + op.action + ': ' + op.path;
        }).join(nl);
        text = summary + nl + nl + text;
      }

      return text.trim();
    }

    function formatContent(content) {
      if (!content) return '';

      let text = content;
      const newline = String.fromCharCode(10);
      const backtick = String.fromCharCode(96);
      const asterisk = String.fromCharCode(42);
      const underscore = String.fromCharCode(95);
      const hash = String.fromCharCode(35);

      // Extract and protect code blocks first (triple backtick blocks)
      const codeBlocks = [];
      const bt3 = backtick + backtick + backtick;
      let idx = 0;
      while (text.indexOf(bt3) !== -1) {
        const start = text.indexOf(bt3);
        const afterStart = start + 3;
        let langEnd = afterStart;
        while (langEnd < text.length && text.charAt(langEnd) !== newline) langEnd++;
        const lang = text.substring(afterStart, langEnd).trim() || 'code';
        const end = text.indexOf(bt3, langEnd);
        if (end === -1) break;
        const code = text.substring(langEnd + 1, end);
        const codeLines = code.trim().split(newline).length;
        const blockId = 'code-block-' + Date.now() + '-' + idx;
        // Create collapsible code block - ALWAYS collapsed by default
        codeBlocks.push(
          '<div class="code-block-wrapper collapsed" id="' + blockId + '">' +
            '<div class="code-block-header" onclick="window.toggleCodeBlock(&quot;' + blockId + '&quot;)">' +
              '<div class="code-block-lang">' +
                '<svg class="code-chevron" width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>' +
                '<span>Thinking</span>' +
              '</div>' +
              '<span class="code-block-lines">' + lang + ' • ' + codeLines + ' lines</span>' +
            '</div>' +
            '<div class="code-block-content">' +
              '<pre class="code-block"><code>' + escapeHtml(code.trim()) + '</code></pre>' +
            '</div>' +
          '</div>'
        );
        text = text.substring(0, start) + '%%CODEBLOCK' + idx + '%%' + text.substring(end + 3);
        idx++;
      }

      // Extract and protect inline code (single backtick spans)
      const inlineCodes = [];
      idx = 0;
      while (text.indexOf(backtick) !== -1) {
        const start = text.indexOf(backtick);
        const end = text.indexOf(backtick, start + 1);
        if (end === -1) break;
        const code = text.substring(start + 1, end);
        if (code.indexOf(newline) === -1) {
          inlineCodes.push('<code class="inline-code">' + escapeHtml(code) + '</code>');
          text = text.substring(0, start) + '%%INLINE' + idx + '%%' + text.substring(end + 1);
          idx++;
        } else {
          break;
        }
      }

      // Convert headers BEFORE escaping (# ## ### at start of line -> styled headers)
      const headerLines = text.split(newline);
      for (let i = 0; i < headerLines.length; i++) {
        let line = headerLines[i];
        let level = 0;
        while (line.length > 0 && line.charAt(0) === hash) {
          level++;
          line = line.substring(1);
        }
        if (level > 0 && line.charAt(0) === ' ') {
          line = line.substring(1);
          // Convert to styled header (h1-h3 styles)
          const headerClass = level <= 2 ? 'header-large' : 'header-medium';
          headerLines[i] = '%%HEADER_START_' + headerClass + '%%' + line + '%%HEADER_END%%';
        }
      }
      text = headerLines.join(newline);

      // Convert bold **text** or __text__ BEFORE escaping
      const doubleAst = asterisk + asterisk;
      const doubleUnd = underscore + underscore;

      // Find and replace **bold** patterns
      let searchPos = 0;
      while (true) {
        const start = text.indexOf(doubleAst, searchPos);
        if (start === -1) break;
        const end = text.indexOf(doubleAst, start + 2);
        if (end === -1) break;
        const boldText = text.substring(start + 2, end);
        if (boldText.indexOf(newline) === -1 && boldText.length > 0) {
          text = text.substring(0, start) + '%%BOLD_START%%' + boldText + '%%BOLD_END%%' + text.substring(end + 2);
          searchPos = start + boldText.length + 20;
        } else {
          searchPos = start + 2;
        }
      }

      // Same for __bold__
      searchPos = 0;
      while (true) {
        const start = text.indexOf(doubleUnd, searchPos);
        if (start === -1) break;
        const end = text.indexOf(doubleUnd, start + 2);
        if (end === -1) break;
        const boldText = text.substring(start + 2, end);
        if (boldText.indexOf(newline) === -1 && boldText.length > 0) {
          text = text.substring(0, start) + '%%BOLD_START%%' + boldText + '%%BOLD_END%%' + text.substring(end + 2);
          searchPos = start + boldText.length + 20;
        } else {
          searchPos = start + 2;
        }
      }

      // Now escape HTML
      text = escapeHtml(text);

      // Convert horizontal rules
      const hrLines = text.split(newline);
      for (let i = 0; i < hrLines.length; i++) {
        const trimmed = hrLines[i].trim();
        if (trimmed === '---' || trimmed === '___') {
          hrLines[i] = '<hr class="chat-hr">';
        }
      }
      text = hrLines.join(newline);

      // Restore formatting placeholders to HTML
      text = text.split('%%BOLD_START%%').join('<strong>');
      text = text.split('%%BOLD_END%%').join('</strong>');
      text = text.split('%%HEADER_START_header-large%%').join('<div class="chat-header-large">');
      text = text.split('%%HEADER_START_header-medium%%').join('<div class="chat-header-medium">');
      text = text.split('%%HEADER_END%%').join('</div>');

      // Restore code blocks and inline code
      for (let i = 0; i < codeBlocks.length; i++) {
        text = text.split('%%CODEBLOCK' + i + '%%').join(codeBlocks[i]);
      }
      for (let i = 0; i < inlineCodes.length; i++) {
        text = text.split('%%INLINE' + i + '%%').join(inlineCodes[i]);
      }

      // Convert to paragraphs with line breaks
      const paragraphs = [];
      const chunks = text.split(newline + newline);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (chunk) {
          const chunkLines = chunk.split(newline);
          paragraphs.push('<p>' + chunkLines.join('<br>') + '</p>');
        }
      }

      return paragraphs.join('') || '<p></p>';
    }

    // Filter thinking content to remove code/XML, keeping only explanations
    function filterThinkingContent(text) {
      if (!text) return '';
      let result = text;

      // Remove file_operation blocks entirely
      while (result.includes('<file_operation>')) {
        const start = result.indexOf('<file_operation>');
        const end = result.indexOf('</file_operation>', start);
        if (end === -1) {
          result = result.substring(0, start);
          break;
        }
        result = result.substring(0, start) + result.substring(end + 17);
      }

      // Remove content blocks (contain code)
      while (result.includes('<content>')) {
        const start = result.indexOf('<content>');
        const end = result.indexOf('</content>', start);
        if (end === -1) {
          result = result.substring(0, start);
          break;
        }
        result = result.substring(0, start) + result.substring(end + 10);
      }

      // Remove markdown code blocks
      while (result.includes('\`\`\`')) {
        const start = result.indexOf('\`\`\`');
        const end = result.indexOf('\`\`\`', start + 3);
        if (end === -1) {
          result = result.substring(0, start);
          break;
        }
        result = result.substring(0, start) + result.substring(end + 3);
      }

      // Remove other XML tags but keep their text content for simple tags
      const tagsToStrip = ['action', 'path', 'description', 'thinking', 'result'];
      for (const tag of tagsToStrip) {
        result = result.split('<' + tag + '>').join('');
        result = result.split('</' + tag + '>').join('');
      }

      // Remove import statements and code-like lines
      const lines = result.split('\\n');
      const cleanLines = [];
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip code-like lines
        if (trimmed.startsWith('import ') ||
            trimmed.startsWith('const ') ||
            trimmed.startsWith('export ') ||
            trimmed.startsWith('function ') ||
            trimmed.startsWith('class ') ||
            trimmed.startsWith('<') ||
            trimmed.includes('className=') ||
            trimmed.includes('=>') ||
            trimmed.match(/^[{}();]$/)) {
          continue;
        }
        if (trimmed) cleanLines.push(trimmed);
      }

      result = cleanLines.join(' ').replace(/\\s+/g, ' ').trim();

      // If nothing left after filtering, return a generic message
      if (result.length < 20) {
        return 'Processing your request...';
      }

      // Truncate if too long
      if (result.length > 500) {
        result = result.substring(0, 500) + '...';
      }

      return result;
    }

    // Detect missing packages from AI response content
    function detectMissingPackages(content) {
      if (!content) return [];
      const packages = [];

      // Pattern 1: "Missing Packages:" followed by package names
      const missingMatch = content.match(/Missing Packages?:?\\s*([\\s\\S]*?)(?:\\n\\n|$)/i);
      if (missingMatch) {
        // Extract package names - look for npm package patterns
        const section = missingMatch[1];
        const pkgMatches = section.match(/@?[a-z0-9][-a-z0-9._]*(?:\\/@?[a-z0-9][-a-z0-9._]*)?/gi);
        if (pkgMatches) {
          pkgMatches.forEach(pkg => {
            // Filter out common false positives
            if (pkg && !pkg.match(/^(the|a|an|to|for|and|or|with|from|npm|install|run|bash)$/i)) {
              packages.push(pkg);
            }
          });
        }
      }

      // Pattern 2: "npm install <packages>" in code blocks
      const npmInstallMatches = content.matchAll(/npm install\\s+([^\\n\`]+)/gi);
      for (const match of npmInstallMatches) {
        const pkgs = match[1].trim().split(/\\s+/);
        pkgs.forEach(pkg => {
          // Filter flags and invalid names
          if (pkg && !pkg.startsWith('-') && pkg.match(/^@?[a-z0-9]/i)) {
            packages.push(pkg);
          }
        });
      }

      // Deduplicate
      return [...new Set(packages)];
    }

    function renderMessage(msg, index) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;

      let html = '';

      // Thinking toggle - filter out code from thinking content
      if (msg.role === 'assistant' && msg.thinking) {
        const filteredThinking = filterThinkingContent(msg.thinking);
        if (filteredThinking && filteredThinking !== 'Processing your request...') {
          html += '<div class="thinking-toggle" data-action="toggle-thinking">▶ Show reasoning</div>';
          html += '<div class="thinking-content">' + escapeHtml(filteredThinking) + '</div>';
        }
      }

      html += formatContent(msg.content);

      div.innerHTML = html;
      return div;
    }

    function toggleThinking(el) {
      const content = el.nextElementSibling;
      const isShown = content.classList.toggle('show');
      el.textContent = isShown ? '▼ Hide reasoning' : '▶ Show reasoning';
    }

    function renderPendingChanges() {
      const pending = currentChanges.filter(c => c.status === 'pending');
      const pendingCmds = currentCommands.filter(c => c.status === 'pending');
      const applied = currentChanges.filter(c => c.status === 'applied');
      const total = pending.length + pendingCmds.length;

      // Null checks for removed elements
      if (pendingCount) {
        pendingCount.textContent = total;
      }
      // Show panel when there are pending OR recently applied items (auto-apply mode - panel removed)
      if (pendingPanel) {
        pendingPanel.classList.toggle('show', currentChanges.length > 0 || currentCommands.length > 0);
      }

      let html = '';

      // File changes
      for (const change of currentChanges) {
        const icon = change.action === 'create' ? '➕' : change.action === 'edit' ? '✏️' : '🗑️';
        const statusClass = change.status !== 'pending' ? change.status : '';

        html += '<div class="pending-item ' + statusClass + '">';
        html += '<span class="pending-icon">' + icon + '</span>';
        html += '<div class="pending-info">';
        html += '<div class="pending-path">' + escapeHtml(change.path) + '</div>';
        if (change.description) {
          html += '<div class="pending-desc">' + escapeHtml(change.description) + '</div>';
        }
        html += '</div>';

        if (change.status === 'pending') {
          html += '<div class="pending-item-actions">';
          if (change.hasContent && change.action !== 'delete') {
            html += '<button class="item-btn preview" data-action="diff" data-id="' + change.id + '" title="Preview changes before applying">👁 Preview</button>';
          }
          html += '<button class="item-btn reject" data-action="reject" data-id="' + change.id + '" title="Reject this change">✕</button>';
          html += '<button class="item-btn accept" data-action="accept" data-id="' + change.id + '" title="Apply this change">✓ Apply</button>';
          html += '</div>';
        } else if (change.status === 'applied') {
          html += '<div class="pending-item-actions">';
          html += '<span style="font-size: 10px; color: #28a745; margin-right: 6px;">✓ applied</span>';
          html += '<button class="item-btn" data-action="undo" data-id="' + change.id + '" title="Undo this change">↩</button>';
          html += '</div>';
        } else {
          html += '<span style="font-size: 10px; opacity: 0.7;">' + change.status + '</span>';
        }

        html += '</div>';
      }

      // Commands
      for (const cmd of currentCommands) {
        const statusClass = cmd.status !== 'pending' ? cmd.status : '';

        html += '<div class="pending-item command-item ' + statusClass + '">';
        html += '<span class="pending-icon">▶</span>';
        html += '<div class="pending-info">';
        html += '<div class="command-text">' + escapeHtml(cmd.command) + '</div>';
        if (cmd.description) {
          html += '<div class="pending-desc">' + escapeHtml(cmd.description) + '</div>';
        }
        html += '</div>';

        if (cmd.status === 'pending') {
          html += '<div class="pending-item-actions">';
          html += '<button class="item-btn accept" data-action="run" data-id="' + cmd.id + '">Run</button>';
          html += '</div>';
        } else {
          html += '<span style="font-size: 10px; opacity: 0.7;">' + cmd.status + '</span>';
        }

        html += '</div>';
      }

      if (pendingList) {
        pendingList.innerHTML = html;
      }
    }

    function renderPinnedFiles() {
      if (pinnedCountEl) {
        pinnedCountEl.textContent = currentPinnedFiles.length;
      }

      // Show/hide sections based on whether files are pinned
      const hasFiles = currentPinnedFiles.length > 0;
      if (pinnedFilesEl) {
        if (hasFiles) {
          pinnedFilesEl.classList.add('show');
          pinnedFilesEl.classList.add('has-files');
        } else {
          pinnedFilesEl.classList.remove('show');
          pinnedFilesEl.classList.remove('has-files');
        }
      }
      if (addFilesHint) {
        addFilesHint.style.display = hasFiles ? 'none' : 'block';
      }

      let html = '';
      for (const file of currentPinnedFiles) {
        html += '<div class="pinned-file">';
        html += '<span class="pinned-file-name" title="' + escapeHtml(file.path) + '">' + escapeHtml(file.name) + '</span>';
        html += '<button class="pinned-file-remove" data-action="remove-pinned" data-path="' + escapeHtml(file.path) + '" title="Remove from context">×</button>';
        html += '</div>';
      }
      if (pinnedListEl) {
        pinnedListEl.innerHTML = html;
      }
    }

    function addPinnedFile() {
      vscode.postMessage({ type: 'addPinnedFile' });
    }

    function removePinnedFile(path) {
      vscode.postMessage({ type: 'removePinnedFile', path: path });
    }

    function clearPinnedFiles() {
      vscode.postMessage({ type: 'clearPinnedFiles' });
    }

    window.addEventListener('message', event => {
      const data = event.data;

      switch (data.type) {
        case 'updateMessages':
          currentMessages = data.messages;
          welcomeEl.style.display = data.messages.length > 0 ? 'none' : 'flex';

          // Clear and re-render messages
          const existing = messagesEl.querySelectorAll('.message');
          existing.forEach(el => el.remove());

          data.messages.forEach((msg, i) => {
            messagesEl.insertBefore(renderMessage(msg, i), streamingEl);
          });

          messagesEl.scrollTop = messagesEl.scrollHeight;
          setStreamingState(false);

          // Parse the last AI response for architecture nodes
          // Only stop animation when we actually receive an assistant response
          if (previewEnabled && data.messages.length > 0) {
            const lastMsg = data.messages[data.messages.length - 1];
            // Only process when the last message is from AI (not user's message)
            if (lastMsg.role === 'assistant' && lastMsg.content) {
              console.log('CodeBakers: Got assistant response, parsing for architecture');
              const { nodes, edges } = parseArchitectureFromResponse(lastMsg.content);
              console.log('CodeBakers: updateMessages - parsed nodes:', nodes.length, 'edges:', edges.length);
              if (nodes.length > 0) {
                // Stop building animation and show nodes with slight delay for visual transition
                setTimeout(() => {
                  stopBuildingAnimation();
                  renderPreviewNodes(nodes, edges);
                }, 300);
              } else {
                // No nodes found, just stop the animation
                stopBuildingAnimation();
              }

              // Auto-detect and install missing packages
              const missingPackages = detectMissingPackages(lastMsg.content);
              if (missingPackages.length > 0) {
                console.log('CodeBakers: Auto-installing missing packages:', missingPackages);
                vscode.postMessage({ type: 'installPackages', packages: missingPackages });
              }
            }
            // If last message is from user, keep animation running - AI is still processing
            console.log('CodeBakers: updateMessages - lastMsg.role:', lastMsg.role);
          }
          break;

        case 'updatePendingChanges':
          currentChanges = data.changes || [];
          currentCommands = data.commands || [];
          renderPendingChanges();
          updatePendingBadge();
          break;

        case 'updatePinnedFiles':
          currentPinnedFiles = data.files || [];
          renderPinnedFiles();
          break;

        case 'toast':
          showToast(data.message, data.action, data.files);
          break;

        case 'typing':
          // CRITICAL: Reset streaming state FIRST when typing stops
          // This must happen before any other code that could throw
          if (!data.isTyping) {
            setStreamingState(false);
          }
          // Now do the rest with null checks
          if (data.isTyping) {
            if (welcomeEl) welcomeEl.style.display = 'none';
            updateAIResponseBar('Processing...', 'Working on your request...', '');
          } else {
            updateAIResponseBar('Ready', 'Click to see last response', '');
          }
          if (streamingEl) streamingEl.classList.toggle('show', data.isTyping);
          if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'setInputValue':
          // Set input field value (e.g., from editor selection context)
          inputEl.value = data.value || '';
          inputEl.focus();
          // Scroll to bottom and trigger resize
          inputEl.style.height = 'auto';
          inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
          break;

        case 'streamThinking':
          // Just keep "Thinking..." showing - no content display needed
          break;

        case 'streamContent':
          // Don't show streaming content - code goes to files, not chat
          // Just keep the "Thinking..." animation running
          // The final response will be shown when done
          break;

        case 'validating':
          // Removed - was confusing "pre-flight check" message
          break;

        case 'streamError':
          if (statusIndicator) statusIndicator.classList.remove('show');
          setStreamingState(false);
          stopBuildingAnimation();
          alert('Error: ' + (data.error || 'Unknown error'));
          break;

        case 'requestCancelled':
          if (statusIndicator) statusIndicator.classList.remove('show');
          setStreamingState(false);
          stopBuildingAnimation();
          break;

        case 'impactAnalysis':
          // Removed - pre-flight panel no longer exists
          break;

        case 'rippleCheck':
          // Show ripple check results after code changes
          showRippleCheck(data);
          break;

        case 'updatePlan':
          const badge = document.getElementById('planBadge');
          if (badge) {
            badge.textContent = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
            badge.className = 'plan-badge' + (data.plan === 'trial' ? ' trial' : '');
          }
          break;

        case 'updateSessionStats':
          updateSessionStats(data.usage);
          break;

        case 'updateTeamNotes':
          if (teamNotesInput) teamNotesInput.value = data.notes || '';
          break;

        case 'showStatus':
          // Removed - status indicator no longer exists
          break;

        case 'showProgress':
          // Removed - status indicator no longer exists
          break;

        case 'showLogin':
          loginPromptEl.classList.add('show');
          mainContentEl.style.display = 'none';
          break;

        case 'hideLogin':
          loginPromptEl.classList.remove('show');
          mainContentEl.style.display = 'flex';
          break;

        case 'updateHealth':
          // Could show health indicator
          break;

        case 'showOnboarding':
          onboardingActive = data.show;
          if (onboardingContainer) {
            if (data.show) {
              onboardingContainer.classList.add('show');
              mainContentEl.style.display = 'none';
              if (loginPromptEl) loginPromptEl.classList.remove('show');
            } else {
              onboardingContainer.classList.remove('show');
              mainContentEl.style.display = 'flex';
            }
          }
          break;

        case 'onboarding-update':
          if (onboardingContent && data.html) {
            onboardingContent.innerHTML = data.html;
          }
          break;

        case 'onboarding-complete':
          onboardingActive = false;
          if (onboardingContainer) {
            onboardingContainer.classList.remove('show');
          }
          mainContentEl.style.display = 'flex';
          // Show welcome with completed message
          if (welcomeEl) {
            welcomeEl.style.display = 'flex';
          }
          break;
      }
    });

    // Status indicator removed - this interval is no longer needed

    // ============================================
    // Event Listeners (CSP-compliant, no inline handlers)
    // ============================================

    // Helper function to safely add event listener
    function safeAddListener(id, event, handler) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(event, handler);
      } else {
        console.warn('CodeBakers: Element not found:', id);
      }
    }

    // Send button
    safeAddListener('sendBtn', 'click', function() {
      console.log('CodeBakers: Send button clicked');
      sendMessage();
    });

    // Cancel button
    safeAddListener('cancelBtn', 'click', function() {
      console.log('CodeBakers: Cancel button clicked');
      cancelRequest();
    });

    // Clear button
    safeAddListener('clearBtn', 'click', function() {
      console.log('CodeBakers: Clear button clicked');
      clearChat();
    });

    // Login button
    safeAddListener('loginBtn', 'click', function() {
      console.log('CodeBakers: Login button clicked');
      login();
    });

    // Accept All button
    safeAddListener('acceptAllBtn', 'click', function() {
      console.log('CodeBakers: Accept All clicked');
      acceptAll();
    });

    // Reject All button
    safeAddListener('rejectAllBtn', 'click', function() {
      console.log('CodeBakers: Reject All clicked');
      rejectAll();
    });

    // Close Pending Panel button
    safeAddListener('pendingCloseBtn', 'click', function() {
      console.log('CodeBakers: Close Pending Panel clicked');
      closePendingPanel();
    });

    // Pinned files buttons
    safeAddListener('addPinnedBtn', 'click', function() {
      console.log('CodeBakers: Add Pinned File clicked');
      addPinnedFile();
    });

    safeAddListener('clearPinnedBtn', 'click', function() {
      console.log('CodeBakers: Clear Pinned Files clicked');
      clearPinnedFiles();
    });

    safeAddListener('addFilesBtn', 'click', function() {
      console.log('CodeBakers: Add Files Hint clicked');
      addPinnedFile();
    });

    // Quick action buttons (welcome screen)
    document.querySelectorAll('.quick-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Quick action clicked:', action);
        quickAction(action);
      });
    });

    // Example chips in getting started section
    document.querySelectorAll('.example-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        const exampleText = this.textContent.replace(/^"|"$/g, '').trim();
        console.log('CodeBakers: Example chip clicked:', exampleText);
        if (inputEl) {
          inputEl.value = exampleText;
          inputEl.focus();
          autoResize(inputEl);
        }
      });
    });

    // Action bar buttons (persistent)
    document.querySelectorAll('.action-bar .action-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Action bar clicked:', action);
        quickAction(action);
      });
    });

    // Input textarea events
    if (inputEl) {
      inputEl.addEventListener('keydown', function(e) {
        handleKeydown(e);
      });

      inputEl.addEventListener('input', function() {
        autoResize(this);
      });
    }

    // ============================================
    // Canvas Mode Event Handlers
    // ============================================

    // View Mode Toggle - Canvas Mode
    if (canvasModeBtn) {
      canvasModeBtn.addEventListener('click', function() {
        console.log('CodeBakers: Canvas Mode clicked');
        setViewMode('canvas');
      });
    }

    // View Mode Toggle - Classic Mode
    if (classicModeBtn) {
      classicModeBtn.addEventListener('click', function() {
        console.log('CodeBakers: Classic Mode clicked');
        setViewMode('classic');
      });
    }

    // Pending Badge - Open Slideout
    if (pendingBadge) {
      pendingBadge.addEventListener('click', function() {
        console.log('CodeBakers: Pending Badge clicked');
        openPendingSlideout();
      });
    }

    // Pending Slideout - Close Button
    if (pendingSlideoutClose) {
      pendingSlideoutClose.addEventListener('click', function() {
        console.log('CodeBakers: Pending Slideout Close clicked');
        closePendingSlideout();
      });
    }

    // Pending Slideout - Overlay Click to Close
    if (pendingOverlay) {
      pendingOverlay.addEventListener('click', function() {
        console.log('CodeBakers: Pending Overlay clicked');
        closePendingSlideout();
      });
    }

    // Pending Slideout - Accept All
    if (slideoutAcceptAll) {
      slideoutAcceptAll.addEventListener('click', function() {
        console.log('CodeBakers: Slideout Accept All clicked');
        acceptAll();
        closePendingSlideout();
      });
    }

    // Pending Slideout - Reject All
    if (slideoutRejectAll) {
      slideoutRejectAll.addEventListener('click', function() {
        console.log('CodeBakers: Slideout Reject All clicked');
        rejectAll();
        closePendingSlideout();
      });
    }

    // AI Response Bar - Toggle Expand/Collapse
    if (aiResponseHeader) {
      aiResponseHeader.addEventListener('click', function() {
        console.log('CodeBakers: AI Response Header clicked');
        toggleAIResponseBar();
      });
    }

    // Canvas Chat Input - Send Button
    if (canvasSendBtn) {
      canvasSendBtn.addEventListener('click', function() {
        console.log('CodeBakers: Canvas Send clicked');
        sendCanvasMessage();
      });
    }

    // Canvas Chat Input - Voice Button
    if (canvasVoiceBtn) {
      canvasVoiceBtn.addEventListener('click', function() {
        console.log('CodeBakers: Canvas Voice clicked');
        startVoiceInput();
      });
    }

    // Canvas Chat Input - Keyboard
    if (canvasInput) {
      canvasInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendCanvasMessage();
        }
      });

      canvasInput.addEventListener('input', function() {
        autoResize(this);
      });
    }

    // Canvas Quick Actions
    document.querySelectorAll('.canvas-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Canvas action clicked:', action);
        handleCanvasAction(action);
      });
    });

    // Initialize Canvas Mode on load
    setViewMode(isCanvasMode ? 'canvas' : 'classic');

    // Event delegation for dynamically created buttons (pending changes, commands, thinking)
    document.addEventListener('click', function(e) {
      const target = e.target;
      if (!target || !target.getAttribute) return;

      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');

      if (action === 'diff' && id) {
        console.log('CodeBakers: Diff clicked for', id);
        showDiff(id);
      } else if (action === 'accept' && id) {
        console.log('CodeBakers: Accept clicked for', id);
        acceptFile(id);
      } else if (action === 'reject' && id) {
        console.log('CodeBakers: Reject clicked for', id);
        rejectFile(id);
      } else if (action === 'undo' && id) {
        console.log('CodeBakers: Undo clicked for', id);
        undoFile(id);
      } else if (action === 'run' && id) {
        console.log('CodeBakers: Run command clicked for', id);
        runCommand(id);
      } else if (action === 'toggle-thinking') {
        console.log('CodeBakers: Toggle thinking clicked');
        const content = target.nextElementSibling;
        if (content) {
          const isShown = content.classList.toggle('show');
          target.textContent = isShown ? '▼ Hide reasoning' : '▶ Show reasoning';
        }
      } else if (action === 'remove-pinned') {
        const path = target.getAttribute('data-path');
        if (path) {
          console.log('CodeBakers: Remove pinned file clicked:', path);
          removePinnedFile(path);
        }
      }
    });

    console.log('CodeBakers: All event listeners registered');
    } catch (error) {
      console.error('CodeBakers: CRITICAL SCRIPT ERROR:', error);
      console.error('CodeBakers: Stack trace:', error.stack);
    }
  </script>
</body>
</html>`;
  }
}
