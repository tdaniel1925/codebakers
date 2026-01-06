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

        // Open the file if not a delete
        if (change.operation.action !== 'delete') {
          await this.fileOps.openFile(change.operation.path);
        }
      } else {
        throw new Error('Operation failed');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed: ${change.operation.path} - ${error}`);
    }

    this._updatePendingChanges();
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
      padding: 10px 14px;
      border-radius: 10px;
      line-height: 1.5;
      font-size: 13px;
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
  </style>
</head>
<body>
  <div class="header">
    <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4 L10 12 L4 20 L8 20 L12 14 L16 20 L20 20 L14 12 L20 4 L16 4 L12 10 L8 4 Z"/>
    </svg>
    <span class="header-title">CodeBakers</span>
    <span class="plan-badge" id="planBadge">Pro</span>
    <button class="header-btn" onclick="clearChat()">Clear</button>
  </div>

  <div class="login-prompt" id="loginPrompt">
    <div class="welcome-icon">🔐</div>
    <div class="welcome-title">Sign in to CodeBakers</div>
    <div class="welcome-text">Connect with GitHub to start your free trial.</div>
    <button class="login-btn" onclick="login()">Sign in with GitHub</button>
  </div>

  <div class="main-content" id="mainContent">
    <div class="messages" id="messages">
      <div class="welcome" id="welcome">
        <div class="welcome-icon">🍪</div>
        <div class="welcome-title">CodeBakers AI</div>
        <div class="welcome-text">Production-ready code with AI. Ask me to build features, edit files, or audit your code.</div>
        <div class="quick-actions">
          <button class="quick-action" onclick="quickAction('/build')">Build Project</button>
          <button class="quick-action" onclick="quickAction('/feature')">Add Feature</button>
          <button class="quick-action" onclick="quickAction('/audit')">Audit Code</button>
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
          <button class="reject-all-btn" onclick="rejectAll()">Reject All</button>
          <button class="accept-all-btn" onclick="acceptAll()">Accept All</button>
        </div>
      </div>
      <div class="pending-list" id="pendingList"></div>
    </div>

    <div class="status-indicator" id="statusIndicator">
      <div class="status-spinner"></div>
      <span id="statusText">Processing...</span>
    </div>
  </div>

  <div class="input-area">
    <textarea
      id="input"
      placeholder="Ask CodeBakers anything..."
      rows="1"
      onkeydown="handleKeydown(event)"
      oninput="autoResize(this)"
    ></textarea>
    <button class="send-btn" id="sendBtn" onclick="sendMessage()">Send</button>
    <button class="cancel-btn" id="cancelBtn" onclick="cancelRequest()">Cancel</button>
  </div>

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

    let currentMessages = [];
    let currentChanges = [];
    let currentCommands = [];
    let isStreaming = false;

    // Command history for up/down navigation
    let commandHistory = JSON.parse(localStorage.getItem('codebakers-history') || '[]');
    let historyIndex = -1;
    let tempInput = ''; // Store current input when navigating

    function sendMessage() {
      const message = inputEl.value.trim();
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
      if (!message || isStreaming) return;

      vscode.postMessage({ type: 'sendMessage', message });
      inputEl.value = '';
      inputEl.style.height = 'auto';
      setStreamingState(true);
    }

    function cancelRequest() {
      vscode.postMessage({ type: 'cancelRequest' });
    }

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
    }

    function quickAction(command) {
      inputEl.value = command + ' ';
      inputEl.focus();
    }

    function clearChat() {
      vscode.postMessage({ type: 'clearChat' });
    }

    function login() {
      vscode.postMessage({ type: 'login' });
    }

    function acceptAll() {
      vscode.postMessage({ type: 'applyAllFiles' });
    }

    function rejectAll() {
      vscode.postMessage({ type: 'rejectAllFiles' });
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
      const bt = String.fromCharCode(96); // backtick
      const bt3 = bt + bt + bt;

      // Step 1: Extract and protect code blocks
      const codeBlocks = [];
      const codeBlockPattern = bt3 + '([a-zA-Z]*)' + String.fromCharCode(10) + '([\\s\\S]*?)' + bt3;
      text = text.replace(new RegExp(codeBlockPattern, 'g'), function(match, lang, code) {
        const idx = codeBlocks.length;
        codeBlocks.push('<pre class="code-block"><code>' + escapeHtml(code.trim()) + '</code></pre>');
        return '%%CODE' + idx + '%%';
      });

      // Step 2: Extract and protect inline code
      const inlineCodes = [];
      const inlinePattern = bt + '([^' + bt + ']+)' + bt;
      text = text.replace(new RegExp(inlinePattern, 'g'), function(match, code) {
        const idx = inlineCodes.length;
        inlineCodes.push('<code class="inline-code">' + escapeHtml(code) + '</code>');
        return '%%INLINE' + idx + '%%';
      });

      // Step 3: Strip markdown to plain text (not converting to HTML tags)
      // Remove headers markers but keep text
      text = text.replace(/^#{1,6} /gm, '');

      // Remove bold markers but keep text: **text** -> text
      text = text.replace(/\*\*([^*]+)\*\*/g, '$1');

      // Remove italic markers but keep text: *text* -> text
      text = text.replace(/\*([^*]+)\*/g, '$1');

      // Remove horizontal rules
      text = text.replace(/^-{3,}$/gm, '');
      text = text.replace(/^_{3,}$/gm, '');
      text = text.replace(/^\*{3,}$/gm, '');

      // Clean up list markers but keep text
      text = text.replace(/^[\-\*] /gm, '• ');
      text = text.replace(/^\d+\. /gm, '• ');

      // Remove link syntax but show text: [text](url) -> text
      text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      // Step 4: Escape HTML in text (but not in code placeholders)
      // Split by placeholders, escape non-placeholder parts, rejoin
      const parts = text.split(/(%%CODE\d+%%|%%INLINE\d+%%)/g);
      text = parts.map(part => {
        if (part.match(/^%%CODE\d+%%$/) || part.match(/^%%INLINE\d+%%$/)) {
          return part; // Keep placeholder as-is
        }
        return escapeHtml(part);
      }).join('');

      // Step 5: Restore code blocks and inline code
      for (let i = 0; i < codeBlocks.length; i++) {
        text = text.replace('%%CODE' + i + '%%', codeBlocks[i]);
      }
      for (let i = 0; i < inlineCodes.length; i++) {
        text = text.replace('%%INLINE' + i + '%%', inlineCodes[i]);
      }

      // Step 6: Handle paragraphs and line breaks
      const paragraphs = text.split(/\n\n+/);
      const formatted = paragraphs.map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<pre') || trimmed.startsWith('<code')) return trimmed;
        return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
      }).filter(p => p).join('');

      return formatted || '<p></p>';
    }

    function renderMessage(msg, index) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;

      let html = '';

      // Thinking toggle
      if (msg.role === 'assistant' && msg.thinking) {
        html += '<div class="thinking-toggle" onclick="toggleThinking(this)">▶ Show reasoning</div>';
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
      const total = pending.length + pendingCmds.length;

      pendingCount.textContent = total;
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
            html += '<button class="item-btn" onclick="showDiff(\'' + change.id + '\')">Diff</button>';
          }
          html += '<button class="item-btn reject" onclick="rejectFile(\'' + change.id + '\')">✕</button>';
          html += '<button class="item-btn accept" onclick="acceptFile(\'' + change.id + '\')">✓</button>';
          html += '</div>';
        } else if (change.status === 'applied') {
          html += '<div class="pending-item-actions">';
          html += '<span style="font-size: 10px; color: #28a745; margin-right: 6px;">✓ applied</span>';
          html += '<button class="item-btn" onclick="undoFile(\'' + change.id + '\')" title="Undo this change">↩</button>';
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
          html += '<button class="item-btn accept" onclick="runCommand(\'' + cmd.id + '\')">Run</button>';
          html += '</div>';
        } else {
          html += '<span style="font-size: 10px; opacity: 0.7;">' + cmd.status + '</span>';
        }

        html += '</div>';
      }

      pendingList.innerHTML = html;
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
          break;

        case 'updatePendingChanges':
          currentChanges = data.changes || [];
          currentCommands = data.commands || [];
          renderPendingChanges();
          break;

        case 'typing':
          if (data.isTyping) {
            welcomeEl.style.display = 'none';
          }
          streamingEl.classList.toggle('show', data.isTyping);
          messagesEl.scrollTop = messagesEl.scrollHeight;
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
          alert('Error: ' + (data.error || 'Unknown error'));
          break;

        case 'requestCancelled':
          statusIndicator.classList.remove('show');
          setStreamingState(false);
          break;

        case 'updatePlan':
          const badge = document.getElementById('planBadge');
          badge.textContent = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);
          badge.className = 'plan-badge' + (data.plan === 'trial' ? ' trial' : '');
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
  </script>
</body>
</html>`;
  }
}
