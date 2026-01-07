import * as vscode from 'vscode';
import { CodeBakersClient, FileOperation, CommandToRun } from './CodeBakersClient';
import { ProjectContext } from './ProjectContext';
import { FileOperations } from './FileOperations';
import { CodeValidator } from './CodeValidator';

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
  status: 'pending' | 'running' | 'done';
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
          this._streamBuffer = content;
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

      // Add file operations to pending changes panel
      if (response.fileOperations && response.fileOperations.length > 0) {
        for (const op of response.fileOperations) {
          this._pendingChanges.push({
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            operation: op,
            status: 'pending'
          });
        }
      }

      // Add commands to pending commands
      if (response.commands && response.commands.length > 0) {
        for (const cmd of response.commands) {
          this._pendingCommands.push({
            id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            command: cmd,
            status: 'pending'
          });
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

    .typing-dots {
      display: flex;
      gap: 4px;
      padding: 8px 0;
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

    /* Team Notes */
    .team-notes {
      padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
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
      flex: 1;
      min-width: 0;
      transition: flex 0.3s ease;
    }

    .split-container.preview-active .main-content {
      flex: 0.55;
    }

    .preview-panel {
      display: none;
      flex-direction: column;
      width: 0;
      background: var(--vscode-sideBar-background, #252526);
      border-left: 1px solid var(--vscode-panel-border, #3c3c3c);
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .split-container.preview-active .preview-panel {
      display: flex;
      flex: 0.45;
      width: auto;
    }

    .preview-header {
      display: flex;
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
      overflow: hidden;
      background:
        radial-gradient(circle at 1px 1px, var(--vscode-panel-border, #3c3c3c) 1px, transparent 0);
      background-size: 20px 20px;
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

    /* Preview Nodes */
    .preview-nodes {
      position: absolute;
      inset: 0;
      padding: 20px;
    }

    .preview-node {
      position: absolute;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      cursor: default;
      opacity: 0;
      transform: scale(0.8);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .preview-node.visible {
      opacity: 1;
      transform: scale(1);
    }

    .preview-node .node-icon {
      margin-right: 6px;
    }

    .preview-node .node-name {
      font-weight: 600;
    }

    .preview-node .node-type {
      font-size: 10px;
      opacity: 0.7;
      margin-left: 8px;
    }

    /* Node type colors */
    .preview-node[data-type="page"] { background: #dbeafe; border: 2px solid #3b82f6; color: #1e40af; }
    .preview-node[data-type="component"] { background: #dcfce7; border: 2px solid #22c55e; color: #166534; }
    .preview-node[data-type="api"] { background: #fef3c7; border: 2px solid #f59e0b; color: #92400e; }
    .preview-node[data-type="database"] { background: #fce7f3; border: 2px solid #ec4899; color: #9d174d; }
    .preview-node[data-type="type"] { background: #e0e7ff; border: 2px solid #6366f1; color: #3730a3; }
    .preview-node[data-type="service"] { background: #ccfbf1; border: 2px solid #14b8a6; color: #115e59; }
    .preview-node[data-type="middleware"] { background: #fed7aa; border: 2px solid #f97316; color: #9a3412; }
    .preview-node[data-type="hook"] { background: #f3e8ff; border: 2px solid #a855f7; color: #6b21a8; }
    .preview-node[data-type="context"] { background: #cffafe; border: 2px solid #06b6d4; color: #155e75; }
    .preview-node[data-type="action"] { background: #fecaca; border: 2px solid #ef4444; color: #991b1b; }
    .preview-node[data-type="job"] { background: #e5e7eb; border: 2px solid #6b7280; color: #374151; }

    /* Preview Edges (SVG) */
    .preview-edges {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .preview-edge {
      stroke: var(--vscode-button-background, #0e639c);
      stroke-width: 2;
      fill: none;
      opacity: 0;
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      transition: opacity 0.3s ease;
    }

    .preview-edge.visible {
      opacity: 0.6;
      animation: drawEdge 0.8s ease forwards;
    }

    @keyframes drawEdge {
      to { stroke-dashoffset: 0; }
    }

    /* Empty State */
    .preview-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground, #888);
    }

    .preview-empty.hidden {
      display: none;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .empty-text {
      font-size: 13px;
      text-align: center;
      max-width: 200px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="header">
    <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4 L10 12 L4 20 L8 20 L12 14 L16 20 L20 20 L14 12 L20 4 L16 4 L12 10 L8 4 Z"/>
    </svg>
    <span class="header-title">CodeBakers</span>
    <span class="plan-badge" id="planBadge">Pro</span>
    <button class="preview-toggle active" id="previewToggle" title="Toggle Live Preview">
      <span class="toggle-icon">🗺️</span>
      <span class="toggle-label">Live</span>
    </button>
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
        <div class="welcome-title">CodeBakers AI</div>
        <div class="welcome-text">Production-ready code with AI. Ask me to build features, edit files, or audit your code.</div>
        <div class="quick-actions">
          <button class="quick-action" data-action="/build">Build Project</button>
          <button class="quick-action" data-action="/feature">Add Feature</button>
          <button class="quick-action" data-action="/audit">🔍 Audit</button>
          <button class="quick-action" data-action="/test">🧪 Test</button>
          <button class="quick-action" data-action="/fix">🔧 Fix</button>
          <button class="quick-action github" data-action="/git-push">📤 Push</button>
          <button class="quick-action deploy" data-action="/deploy">🚀 Deploy</button>
        </div>
      </div>

      <div class="streaming-indicator" id="streaming">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <div id="streamingContent" style="margin-top: 8px; display: none;"></div>
      </div>
    </div>

    <!-- Claude Code Style Pending Changes Panel -->
    <div class="pending-panel" id="pendingPanel">
      <div class="pending-header">
        <div class="pending-title">
          <span>Pending Changes</span>
          <span class="pending-count" id="pendingCount">0</span>
        </div>
        <div class="pending-actions">
          <button class="reject-all-btn" id="rejectAllBtn">Reject All</button>
          <button class="accept-all-btn" id="acceptAllBtn">Accept All</button>
          <button class="pending-close-btn" id="pendingCloseBtn" title="Close">×</button>
        </div>
      </div>
      <div class="pending-list" id="pendingList"></div>
    </div>

    <div class="status-indicator" id="statusIndicator">
      <div class="status-spinner"></div>
      <span id="statusText">Processing...</span>
    </div>
    </div>

    <!-- Live Preview Panel -->
    <div class="preview-panel" id="previewPanel">
      <div class="preview-header">
        <span class="preview-title">🗺️ Your App Architecture</span>
        <span class="preview-hint">Watch your app take shape</span>
      </div>
      <div class="preview-canvas" id="previewCanvas">
        <!-- Building Animation -->
        <div class="building-overlay" id="buildingOverlay">
          <div class="building-animation">
            <div class="blueprint-grid"></div>
            <div class="building-text">Building your app...</div>
            <div class="building-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
        <!-- Nodes will be rendered here -->
        <svg class="preview-edges" id="previewEdges"></svg>
        <div class="preview-nodes" id="previewNodes"></div>
        <!-- Empty state -->
        <div class="preview-empty" id="previewEmpty">
          <div class="empty-icon">🏗️</div>
          <div class="empty-text">Start chatting to see your app architecture appear here</div>
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

    let currentMessages = [];
    let currentChanges = [];
    let currentCommands = [];
    let currentPinnedFiles = [];
    let isStreaming = false;

    // Live Preview state
    let previewEnabled = true;
    let previewNodesData = [];
    let previewEdgesData = [];

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
        statTimeEl.style.opacity = '0.5'; // Dim to show idle
        statTimeEl.title = 'Timer paused (idle)';
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Track user activity
    function recordActivity() {
      const now = Date.now();
      if (!sessionStats.isActive) {
        // User came back from idle
        sessionStats.isActive = true;
        statTimeEl.style.opacity = '1';
        statTimeEl.title = '';
      } else {
        // Add active time since last activity (capped at reasonable amount)
        const timeDiff = Math.min(now - sessionStats.lastActivity, IDLE_THRESHOLD);
        sessionStats.activeTime += timeDiff;
      }
      sessionStats.lastActivity = now;
    }

    // Register activity on user interactions
    inputEl.addEventListener('input', recordActivity);
    inputEl.addEventListener('focus', recordActivity);
    document.addEventListener('click', recordActivity);
    document.addEventListener('keydown', recordActivity);

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

      statTimeEl.textContent = activeDisplay;
      statTimeEl.title = sessionStats.isActive ? 'Active time (billable)' : 'Timer paused (idle)';
    }

    function updateSessionStats(usage) {
      recordActivity(); // Mark activity when we get a response

      if (usage) {
        sessionStats.requests += 1;
        sessionStats.tokens += usage.totalTokens || 0;
        sessionStats.cost += usage.estimatedCost || 0;
      }
      statRequestsEl.textContent = sessionStats.requests;
      statTokensEl.textContent = sessionStats.tokens.toLocaleString();
      statCostEl.textContent = '$' + sessionStats.cost.toFixed(4);
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

    resetStatsBtn.addEventListener('click', resetSessionStats);

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
        voiceBtn.classList.add('listening');
        voiceBtn.textContent = '🔴';
        voiceStatus.textContent = 'Listening...';
        voiceStatus.classList.add('show');
      };

      recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎤';
        voiceStatus.classList.remove('show');
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
          inputEl.value = transcript;
          voiceStatus.textContent = 'Listening: ' + transcript.substring(0, 30) + '...';
        } else {
          // Final result - put in input and optionally send
          inputEl.value = transcript;
          voiceStatus.textContent = 'Got: ' + transcript.substring(0, 30) + (transcript.length > 30 ? '...' : '');

          // Auto-resize textarea
          inputEl.style.height = 'auto';
          inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';

          // Auto-send after brief delay (user can cancel by clicking elsewhere)
          setTimeout(() => {
            if (inputEl.value === transcript && transcript.trim()) {
              sendMessage();
            }
          }, 500);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎤';

        if (event.error === 'not-allowed') {
          voiceStatus.textContent = 'Microphone access denied';
        } else if (event.error === 'no-speech') {
          voiceStatus.textContent = 'No speech detected';
        } else {
          voiceStatus.textContent = 'Error: ' + event.error;
        }

        setTimeout(() => voiceStatus.classList.remove('show'), 2000);
      };
    } else {
      // Speech recognition not supported
      voiceBtn.style.display = 'none';
    }

    voiceBtn.addEventListener('click', () => {
      if (!recognition) {
        voiceStatus.textContent = 'Voice not supported in this environment';
        voiceStatus.classList.add('show');
        setTimeout(() => voiceStatus.classList.remove('show'), 2000);
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

    // Team Notes functionality
    const teamNotesInput = document.getElementById('teamNotesInput');
    const saveTeamNotesBtn = document.getElementById('saveTeamNotesBtn');

    // Load team notes on startup
    vscode.postMessage({ type: 'loadTeamNotes' });

    saveTeamNotesBtn.addEventListener('click', () => {
      const notes = teamNotesInput.value;
      vscode.postMessage({ type: 'saveTeamNotes', notes });
      saveTeamNotesBtn.textContent = 'Saved ✓';
      setTimeout(() => {
        saveTeamNotesBtn.textContent = 'Save';
      }, 1500);
    });

    // Auto-save on blur
    teamNotesInput.addEventListener('blur', () => {
      const notes = teamNotesInput.value;
      if (notes.trim()) {
        vscode.postMessage({ type: 'saveTeamNotes', notes });
      }
    });

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

      console.log('CodeBakers: posting message to extension');
      vscode.postMessage({ type: 'sendMessage', message });
      inputEl.value = '';
      inputEl.style.height = 'auto';
      setStreamingState(true);
      startBuildingAnimation();
    }

    function cancelRequest() {
      vscode.postMessage({ type: 'cancelRequest' });
    }

    let buildingAnimationActive = false;

    function setStreamingState(streaming) {
      isStreaming = streaming;
      sendBtn.style.display = streaming ? 'none' : 'block';
      cancelBtn.classList.toggle('show', streaming);
      inputEl.disabled = streaming;
      streamingEl.classList.toggle('show', streaming);

      if (streaming) {
        streamingContentEl.style.display = 'none';
        streamingContentEl.innerHTML = '';
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

    // Node type colors matching types.ts
    const NODE_COLORS = {
      page: { bg: '#dbeafe', border: '#3b82f6', icon: '📄' },
      component: { bg: '#dcfce7', border: '#22c55e', icon: '🧩' },
      api: { bg: '#fef3c7', border: '#f59e0b', icon: '🔌' },
      database: { bg: '#fce7f3', border: '#ec4899', icon: '🗄️' },
      type: { bg: '#e0e7ff', border: '#6366f1', icon: '📝' },
      hook: { bg: '#f3e8ff', border: '#a855f7', icon: '🪝' },
      service: { bg: '#ccfbf1', border: '#14b8a6', icon: '⚙️' },
      middleware: { bg: '#fed7aa', border: '#f97316', icon: '🔀' },
      context: { bg: '#cffafe', border: '#06b6d4', icon: '🌐' },
      action: { bg: '#fecaca', border: '#ef4444', icon: '⚡' },
      job: { bg: '#e5e7eb', border: '#6b7280', icon: '⏰' }
    };

    function renderPreviewNodes(nodes, edges) {
      console.log('CodeBakers: renderPreviewNodes called with', nodes.length, 'nodes and', edges.length, 'edges');
      if (!previewEnabled) return;

      previewNodesData = nodes || [];
      previewEdgesData = edges || [];

      // Clear existing
      previewNodes.innerHTML = '';
      previewEdges.innerHTML = '';

      if (previewNodesData.length === 0) {
        previewEmpty.style.display = 'flex';
        return;
      }

      previewEmpty.style.display = 'none';

      // Calculate positions in a simple grid layout
      const canvasWidth = previewCanvas.offsetWidth - 40;
      const canvasHeight = previewCanvas.offsetHeight - 60;
      const cols = Math.ceil(Math.sqrt(previewNodesData.length));
      const rows = Math.ceil(previewNodesData.length / cols);
      const cellWidth = canvasWidth / cols;
      const cellHeight = canvasHeight / rows;

      // Render nodes with staggered animation
      previewNodesData.forEach((node, index) => {
        const colors = NODE_COLORS[node.type] || NODE_COLORS.component;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = 20 + col * cellWidth + cellWidth / 2 - 60;
        const y = 40 + row * cellHeight + cellHeight / 2 - 30;

        const nodeEl = document.createElement('div');
        nodeEl.className = 'preview-node reveal node-' + node.type;
        nodeEl.style.left = x + 'px';
        nodeEl.style.top = y + 'px';
        nodeEl.style.animationDelay = (index * 150) + 'ms';
        nodeEl.dataset.nodeId = node.id;
        nodeEl.innerHTML = '<span class="preview-node-icon">' + colors.icon + '</span>' +
          '<span class="preview-node-name">' + escapeHtml(node.name) + '</span>' +
          '<span class="preview-node-type">' + node.type + '</span>';

        previewNodes.appendChild(nodeEl);

        // Store position for edge drawing
        node._x = x + 60; // center
        node._y = y + 30;
      });

      // Render edges after nodes are positioned
      setTimeout(() => {
        renderPreviewEdges();
      }, previewNodesData.length * 150 + 200);
    }

    function renderPreviewEdges() {
      if (!previewEnabled || previewEdgesData.length === 0) return;

      const svgNS = 'http://www.w3.org/2000/svg';
      previewEdges.innerHTML = '';

      previewEdgesData.forEach((edge, index) => {
        const sourceNode = previewNodesData.find(n => n.id === edge.source);
        const targetNode = previewNodesData.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return;

        const path = document.createElementNS(svgNS, 'path');
        const x1 = sourceNode._x;
        const y1 = sourceNode._y;
        const x2 = targetNode._x;
        const y2 = targetNode._y;

        // Curved path
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - 30;
        const d = 'M ' + x1 + ' ' + y1 + ' Q ' + midX + ' ' + midY + ' ' + x2 + ' ' + y2;

        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--vscode-textLink-foreground)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '1000');
        path.setAttribute('stroke-dashoffset', '1000');
        path.style.animation = 'drawEdge 0.8s ease forwards';
        path.style.animationDelay = (index * 100) + 'ms';

        previewEdges.appendChild(path);
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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
    previewToggleBtn.addEventListener('click', togglePreview);

    // Initialize preview panel state (default: enabled)
    if (previewEnabled) {
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
      // Ctrl+Shift+A: Accept all pending changes
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        acceptAll();
        return;
      }

      // Escape: Cancel current request
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRequest();
        return;
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

      // Ctrl+/ : Focus input
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        inputEl.focus();
        return;
      }
    });

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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
        const end = text.indexOf(bt3, langEnd);
        if (end === -1) break;
        const code = text.substring(langEnd + 1, end);
        codeBlocks.push('<pre class="code-block"><code>' + escapeHtml(code.trim()) + '</code></pre>');
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

    function renderMessage(msg, index) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;

      let html = '';

      // Thinking toggle
      if (msg.role === 'assistant' && msg.thinking) {
        html += '<div class="thinking-toggle" data-action="toggle-thinking">▶ Show reasoning</div>';
        html += '<div class="thinking-content">' + escapeHtml(msg.thinking) + '</div>';
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

      pendingCount.textContent = total;
      // Show panel when there are pending OR recently applied items (applied items auto-clear after delay)
      pendingPanel.classList.toggle('show', currentChanges.length > 0 || currentCommands.length > 0);

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

      pendingList.innerHTML = html;
    }

    function renderPinnedFiles() {
      pinnedCountEl.textContent = currentPinnedFiles.length;

      // Show/hide sections based on whether files are pinned
      if (currentPinnedFiles.length > 0) {
        pinnedFilesEl.classList.add('show');
        addFilesHint.style.display = 'none';
      } else {
        pinnedFilesEl.classList.remove('show');
        addFilesHint.style.display = 'block';
      }

      let html = '';
      for (const file of currentPinnedFiles) {
        html += '<div class="pinned-file">';
        html += '<span class="pinned-file-name" title="' + escapeHtml(file.path) + '">' + escapeHtml(file.name) + '</span>';
        html += '<button class="pinned-file-remove" data-action="remove-pinned" data-path="' + escapeHtml(file.path) + '" title="Remove from context">×</button>';
        html += '</div>';
      }
      pinnedListEl.innerHTML = html;
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
            }
            // If last message is from user, keep animation running - AI is still processing
            console.log('CodeBakers: updateMessages - lastMsg.role:', lastMsg.role);
          }
          break;

        case 'updatePendingChanges':
          currentChanges = data.changes || [];
          currentCommands = data.commands || [];
          renderPendingChanges();
          break;

        case 'updatePinnedFiles':
          currentPinnedFiles = data.files || [];
          renderPinnedFiles();
          break;

        case 'typing':
          if (data.isTyping) {
            welcomeEl.style.display = 'none';
          } else {
            setStreamingState(false);
          }
          streamingEl.classList.toggle('show', data.isTyping);
          messagesEl.scrollTop = messagesEl.scrollHeight;
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
          // Could show thinking indicator if desired
          break;

        case 'streamContent':
          streamingContentEl.style.display = 'block';
          streamingContentEl.innerHTML = formatContent(data.content);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'validating':
          statusText.textContent = 'Validating TypeScript...';
          statusIndicator.classList.add('show');
          break;

        case 'streamError':
          statusIndicator.classList.remove('show');
          setStreamingState(false);
          stopBuildingAnimation();
          alert('Error: ' + (data.error || 'Unknown error'));
          break;

        case 'requestCancelled':
          statusIndicator.classList.remove('show');
          setStreamingState(false);
          stopBuildingAnimation();
          break;

        case 'updatePlan':
          const badge = document.getElementById('planBadge');
          badge.textContent = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
          badge.className = 'plan-badge' + (data.plan === 'trial' ? ' trial' : '');
          break;

        case 'updateSessionStats':
          updateSessionStats(data.usage);
          break;

        case 'updateTeamNotes':
          teamNotesInput.value = data.notes || '';
          break;

        case 'showStatus':
          if (data.show) {
            statusText.textContent = data.text || 'Processing...';
            statusIndicator.classList.add('show');
          } else {
            statusIndicator.classList.remove('show');
          }
          break;

        case 'showProgress':
          if (data.show) {
            const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
            statusText.innerHTML = data.text + '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
            statusIndicator.classList.add('show');
          } else {
            statusIndicator.classList.remove('show');
          }
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
      }
    });

    // Hide status after a delay
    setInterval(() => {
      if (!isStreaming) {
        statusIndicator.classList.remove('show');
      }
    }, 3000);

    // ============================================
    // Event Listeners (CSP-compliant, no inline handlers)
    // ============================================

    // Send button
    document.getElementById('sendBtn').addEventListener('click', function() {
      console.log('CodeBakers: Send button clicked');
      sendMessage();
    });

    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', function() {
      console.log('CodeBakers: Cancel button clicked');
      cancelRequest();
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', function() {
      console.log('CodeBakers: Clear button clicked');
      clearChat();
    });

    // Login button
    document.getElementById('loginBtn').addEventListener('click', function() {
      console.log('CodeBakers: Login button clicked');
      login();
    });

    // Accept All button
    document.getElementById('acceptAllBtn').addEventListener('click', function() {
      console.log('CodeBakers: Accept All clicked');
      acceptAll();
    });

    // Reject All button
    document.getElementById('rejectAllBtn').addEventListener('click', function() {
      console.log('CodeBakers: Reject All clicked');
      rejectAll();
    });

    // Close Pending Panel button
    document.getElementById('pendingCloseBtn').addEventListener('click', function() {
      console.log('CodeBakers: Close Pending Panel clicked');
      closePendingPanel();
    });

    // Pinned files buttons
    document.getElementById('addPinnedBtn').addEventListener('click', function() {
      console.log('CodeBakers: Add Pinned File clicked');
      addPinnedFile();
    });

    document.getElementById('clearPinnedBtn').addEventListener('click', function() {
      console.log('CodeBakers: Clear Pinned Files clicked');
      clearPinnedFiles();
    });

    document.getElementById('addFilesBtn').addEventListener('click', function() {
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

    // Action bar buttons (persistent)
    document.querySelectorAll('.action-bar .action-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        console.log('CodeBakers: Action bar clicked:', action);
        quickAction(action);
      });
    });

    // Input textarea events
    inputEl.addEventListener('keydown', function(e) {
      handleKeydown(e);
    });

    inputEl.addEventListener('input', function() {
      autoResize(this);
    });

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
  </script>
</body>
</html>`;
  }
}
