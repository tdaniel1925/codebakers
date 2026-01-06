import * as vscode from 'vscode';
import { CodeBakersClient, FileOperation, CommandToRun } from './CodeBakersClient';
import { ProjectContext } from './ProjectContext';
import { FileOperations } from './FileOperations';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  fileOperations?: FileOperation[];
  commands?: CommandToRun[];
  timestamp: Date;
}

export class ChatPanelProvider {
  private static _instance: ChatPanelProvider | undefined;
  private _panel: vscode.WebviewPanel | undefined;
  private _messages: Message[] = [];
  private _conversationSummary: string = '';
  private readonly fileOps: FileOperations;
  private _abortController: AbortController | null = null;

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
          this._updateWebview();
          break;
        case 'runTool':
          await this._executeTool(data.tool);
          break;
        case 'login':
          await this.client.login();
          break;
        case 'applyFile':
          await this._applyFileOperation(data.operation);
          break;
        case 'applyAllFiles':
          await this._applyAllFileOperations(data.operations);
          break;
        case 'runCommand':
          await this._runCommand(data.command);
          break;
        case 'showDiff':
          await this._showDiff(data.path, data.content);
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

      this._panel.webview.postMessage({
        type: 'toolResult',
        tool: toolName,
        result: result.data || result
      });

      if (toolName === 'guardian_status' && result.data?.health) {
        this._panel.webview.postMessage({
          type: 'updateHealth',
          health: result.data.health,
          score: result.data.health
        });
      }
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'toolResult',
        tool: toolName,
        result: { error: error instanceof Error ? error.message : 'Tool execution failed' }
      });
    } finally {
      this._panel?.webview.postMessage({ type: 'typing', isTyping: false });
    }
  }

  private async _applyFileOperation(operation: FileOperation) {
    if (!this._panel) return;

    try {
      const success = await this.fileOps.applyChange({
        path: operation.path,
        action: operation.action,
        content: operation.content,
        description: operation.description
      });

      if (success) {
        vscode.window.showInformationMessage(`✅ ${operation.action}: ${operation.path}`);
        this._panel.webview.postMessage({
          type: 'fileApplied',
          path: operation.path,
          success: true
        });

        // Open the file in the editor
        if (operation.action !== 'delete') {
          await this.fileOps.openFile(operation.path);
        }
      } else {
        throw new Error('File operation failed');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to ${operation.action} ${operation.path}: ${error}`);
      this._panel.webview.postMessage({
        type: 'fileApplied',
        path: operation.path,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async _applyAllFileOperations(operations: FileOperation[]) {
    if (!this._panel) return;

    const result = await this.fileOps.applyChanges(
      operations.map(op => ({
        path: op.path,
        action: op.action,
        content: op.content,
        description: op.description
      }))
    );

    vscode.window.showInformationMessage(
      `✅ Applied ${result.success} file(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`
    );

    this._panel.webview.postMessage({
      type: 'allFilesApplied',
      success: result.success,
      failed: result.failed
    });
  }

  private async _runCommand(command: CommandToRun) {
    if (!this._panel) return;

    try {
      await this.fileOps.runCommand(command.command, command.description || 'CodeBakers');
      vscode.window.showInformationMessage(`🚀 Running: ${command.command}`);
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to run command: ${error}`);
    }
  }

  private async _showDiff(path: string, content: string) {
    if (!this._panel) return;

    try {
      await this.fileOps.showDiff(path, content, `CodeBakers: ${path}`);
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to show diff: ${error}`);
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

  async sendMessage(userMessage: string) {
    if (!this._panel) return;

    // Check if user is logged in before trying to send
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

    try {
      // Create abort controller for this request
      this._abortController = new AbortController();

      this._panel.webview.postMessage({ type: 'typing', isTyping: true });

      const projectState = await this.projectContext.getProjectState();
      const contextualizedMessages = await this._buildContextualizedMessages(userMessage, projectState);

      // Use streaming callbacks to show thinking and content in real-time
      const response = await this.client.chat(contextualizedMessages, projectState, {
        onThinking: (thinking) => {
          this._panel?.webview.postMessage({
            type: 'streamThinking',
            thinking
          });
        },
        onContent: (content) => {
          this._panel?.webview.postMessage({
            type: 'streamContent',
            content
          });
        },
        onDone: () => {
          // Show validation progress
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

      this._messages.push({
        role: 'assistant',
        content: response.content,
        thinking: response.thinking,
        fileOperations: response.fileOperations,
        commands: response.commands,
        timestamp: new Date()
      });

      if (response.projectUpdates) {
        await this.projectContext.applyUpdates(response.projectUpdates);
      }

      if (this._messages.length > 20) {
        await this._summarizeConversation();
      }
    } catch (error) {
      this._messages.push({
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
    } finally {
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
        fileOperations: m.fileOperations,
        commands: m.commands,
        timestamp: m.timestamp.toISOString()
      }))
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
      padding: 16px 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      width: 24px;
      height: 24px;
    }

    .header-title {
      font-weight: 600;
      font-size: 14px;
      flex: 1;
    }

    .clear-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
    }

    .clear-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .health-bar {
      padding: 8px 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
    }

    .health-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
    }

    .health-indicator.warning { background: #ff9800; }
    .health-indicator.error { background: #f44336; }

    .health-text {
      flex: 1;
      color: var(--vscode-descriptionForeground);
    }

    .health-score {
      font-weight: 600;
      color: #4caf50;
    }

    .plan-badge {
      font-size: 11px;
      padding: 3px 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 12px;
    }

    .plan-badge.trial {
      background: #f0a030;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.6;
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
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 10px 0;
    }

    .message code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }

    .message h1, .message h2, .message h3, .message h4 {
      margin: 12px 0 8px 0;
      font-weight: 600;
      line-height: 1.3;
    }

    .message h1 { font-size: 1.4em; }
    .message h2 { font-size: 1.25em; }
    .message h3 { font-size: 1.1em; }
    .message h4 { font-size: 1em; }

    .message ul, .message ol {
      margin: 8px 0;
      padding-left: 20px;
    }

    .message li {
      margin: 4px 0;
    }

    .message hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 12px 0;
    }

    .message strong {
      font-weight: 600;
    }

    .message em {
      font-style: italic;
    }

    .message p {
      margin: 8px 0;
    }

    .message p:first-child {
      margin-top: 0;
    }

    .message p:last-child {
      margin-bottom: 0;
    }

    .typing-indicator {
      display: none;
      align-self: flex-start;
      padding: 12px 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 12px;
    }

    .typing-indicator.show {
      display: flex;
      gap: 5px;
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      background: var(--vscode-foreground);
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    .thinking-block {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }

    .thinking-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      user-select: none;
    }

    .thinking-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .thinking-icon {
      transition: transform 0.2s;
    }

    .thinking-block.collapsed .thinking-icon {
      transform: rotate(-90deg);
    }

    .thinking-content {
      padding: 0 12px 12px 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
    }

    .thinking-block.collapsed .thinking-content {
      display: none;
    }

    .file-operations {
      margin-top: 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .file-ops-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .file-ops-title {
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .apply-all-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      font-size: 11px;
      cursor: pointer;
    }

    .apply-all-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .file-op-card {
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .file-op-card:last-child {
      border-bottom: none;
    }

    .file-op-icon {
      font-size: 14px;
    }

    .file-op-info {
      flex: 1;
      min-width: 0;
    }

    .file-op-path {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      word-break: break-all;
    }

    .file-op-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }

    .file-op-actions {
      display: flex;
      gap: 6px;
    }

    .file-op-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
    }

    .file-op-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .file-op-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .file-op-btn.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .file-op-btn.applied {
      background: #4caf50;
      color: white;
      cursor: default;
    }

    .commands-section {
      margin-top: 12px;
    }

    .command-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .command-text {
      flex: 1;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
    }

    .command-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .run-cmd-btn {
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }

    .run-cmd-btn:hover {
      background: #45a049;
    }

    .streaming-block {
      align-self: flex-start;
      max-width: 85%;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      overflow: hidden;
    }

    .streaming-thinking {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      padding: 10px 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      max-height: 200px;
      overflow-y: auto;
    }

    .streaming-thinking-header {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .streaming-content {
      padding: 12px 16px;
      line-height: 1.6;
      font-size: 13px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .thinking-pulse {
      animation: pulse 1.5s infinite;
    }

    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }

    .welcome-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .welcome-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .welcome-text {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 30px;
      max-width: 400px;
    }

    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }

    .quick-action {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 20px;
      padding: 8px 18px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }

    .quick-action:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .login-prompt {
      flex: 1;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }

    .login-prompt.show {
      display: flex;
    }

    .login-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-top: 20px;
    }

    .login-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .tools-bar {
      padding: 10px 20px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tool-chip {
      font-size: 11px;
      padding: 5px 10px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .tool-chip:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .input-area {
      padding: 16px 20px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 10px;
    }

    .input-area textarea {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 12px 14px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      min-height: 44px;
      max-height: 150px;
    }

    .input-area textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 8px;
      padding: 0 20px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
    }

    .send-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .cancel-btn {
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0 20px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      display: none;
    }

    .cancel-btn:hover {
      background: #c0392b;
    }

    .cancel-btn.show {
      display: block;
    }

    .validation-indicator {
      display: none;
      align-self: flex-start;
      padding: 12px 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .validation-indicator.show {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .validation-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--vscode-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-message {
      align-self: flex-start;
      max-width: 85%;
      padding: 12px 16px;
      background: rgba(231, 76, 60, 0.2);
      border: 1px solid #e74c3c;
      border-radius: 12px;
      color: #e74c3c;
      font-size: 13px;
    }

    .footer {
      padding: 10px 20px;
      text-align: center;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border);
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
    <button class="clear-btn" onclick="clearChat()">Clear</button>
  </div>

  <div class="health-bar" id="healthBar">
    <div class="health-indicator" id="healthIndicator"></div>
    <span class="health-text">Project Health</span>
    <span class="health-score" id="healthScore">--</span>
  </div>

  <div class="login-prompt" id="loginPrompt">
    <div class="welcome-icon">🔐</div>
    <div class="welcome-title">Sign in to CodeBakers</div>
    <div class="welcome-text">Connect with GitHub to start your free trial and access AI-powered coding with production-ready patterns.</div>
    <button class="login-btn" onclick="login()">Sign in with GitHub</button>
  </div>

  <div class="messages" id="messages">
    <div class="welcome" id="welcome">
      <div class="welcome-icon">✨</div>
      <div class="welcome-title">CodeBakers AI</div>
      <div class="welcome-text">Production-ready code patterns with AI. Ask me to build features, audit code, or help with your project.</div>
      <div class="quick-actions">
        <button class="quick-action" onclick="quickAction('/build')">🔨 Build Project</button>
        <button class="quick-action" onclick="quickAction('/feature')">✨ Add Feature</button>
        <button class="quick-action" onclick="quickAction('/audit')">🔍 Audit Code</button>
        <button class="quick-action" onclick="runTool('guardian_status')">🛡️ Health Check</button>
      </div>
    </div>

    <div class="streaming-block" id="streaming" style="display: none;">
      <div class="streaming-thinking" id="streamingThinking" style="display: none;">
        <div class="streaming-thinking-header">
          <span class="thinking-pulse">🧠</span> Thinking...
        </div>
        <div id="streamingThinkingContent"></div>
      </div>
      <div class="streaming-content" id="streamingContent"></div>
    </div>

    <div class="validation-indicator" id="validating">
      <div class="validation-spinner"></div>
      <span id="validatingText">Validating code...</span>
    </div>

    <div class="typing-indicator" id="typing">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  </div>

  <div class="tools-bar">
    <button class="tool-chip" onclick="runTool('guardian_status')">🛡️ Guardian</button>
    <button class="tool-chip" onclick="runTool('list_patterns')">📋 Patterns</button>
    <button class="tool-chip" onclick="runTool('run_tests')">🧪 Tests</button>
    <button class="tool-chip" onclick="runTool('run_audit')">🔍 Audit</button>
    <button class="tool-chip" onclick="runTool('ripple_check')">🌊 Ripple</button>
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

  <div class="footer">
    Powered by CodeBakers — a BotMakers Software
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const loginPromptEl = document.getElementById('loginPrompt');
    const typingEl = document.getElementById('typing');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const validatingEl = document.getElementById('validating');
    const validatingTextEl = document.getElementById('validatingText');
    const streamingEl = document.getElementById('streaming');
    const streamingThinkingEl = document.getElementById('streamingThinking');
    const streamingThinkingContentEl = document.getElementById('streamingThinkingContent');
    const streamingContentEl = document.getElementById('streamingContent');

    let isStreaming = false;

    function sendMessage() {
      const message = inputEl.value.trim();
      if (!message) return;

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
      if (streaming) {
        sendBtn.style.display = 'none';
        cancelBtn.classList.add('show');
        inputEl.disabled = true;
      } else {
        sendBtn.style.display = 'block';
        sendBtn.disabled = false;
        cancelBtn.classList.remove('show');
        inputEl.disabled = false;
        validatingEl.classList.remove('show');
      }
    }

    function quickAction(command) {
      inputEl.value = command + ' ';
      inputEl.focus();
    }

    function clearChat() {
      vscode.postMessage({ type: 'clearChat' });
    }

    function runTool(toolName) {
      vscode.postMessage({ type: 'runTool', tool: toolName });
    }

    function login() {
      vscode.postMessage({ type: 'login' });
    }

    function updateHealth(health, score) {
      const indicator = document.getElementById('healthIndicator');
      const scoreEl = document.getElementById('healthScore');

      scoreEl.textContent = score + '%';

      indicator.className = 'health-indicator';
      if (score < 50) {
        indicator.classList.add('error');
        scoreEl.style.color = '#f44336';
      } else if (score < 80) {
        indicator.classList.add('warning');
        scoreEl.style.color = '#ff9800';
      } else {
        scoreEl.style.color = '#4caf50';
      }
    }

    function updatePlan(plan) {
      const badge = document.getElementById('planBadge');
      badge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
      badge.className = 'plan-badge';
      if (plan === 'trial') {
        badge.classList.add('trial');
      }
    }

    function handleKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }

    function renderMessage(msg, msgIndex) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;

      let html = '';

      // Add thinking block if present (for assistant messages)
      if (msg.role === 'assistant' && msg.thinking) {
        html += '<div class="thinking-block collapsed" onclick="toggleThinking(this)">';
        html += '<div class="thinking-header">';
        html += '<span class="thinking-icon">▼</span>';
        html += '<span>🧠 View reasoning</span>';
        html += '</div>';
        html += '<div class="thinking-content">' + escapeHtml(msg.thinking) + '</div>';
        html += '</div>';
      }

      html += formatContent(msg.content);

      // Add file operations section if present
      if (msg.role === 'assistant' && msg.fileOperations && msg.fileOperations.length > 0) {
        html += '<div class="file-operations">';
        html += '<div class="file-ops-header">';
        html += '<span class="file-ops-title">📁 File Changes (' + msg.fileOperations.length + ')</span>';
        if (msg.fileOperations.length > 1) {
          html += '<button class="apply-all-btn" onclick="applyAllFiles(' + msgIndex + ')">Apply All</button>';
        }
        html += '</div>';

        msg.fileOperations.forEach((op, opIndex) => {
          const icon = op.action === 'create' ? '➕' : op.action === 'edit' ? '✏️' : '🗑️';
          html += '<div class="file-op-card" id="file-op-' + msgIndex + '-' + opIndex + '">';
          html += '<span class="file-op-icon">' + icon + '</span>';
          html += '<div class="file-op-info">';
          html += '<div class="file-op-path">' + escapeHtml(op.path) + '</div>';
          if (op.description) {
            html += '<div class="file-op-desc">' + escapeHtml(op.description) + '</div>';
          }
          html += '</div>';
          html += '<div class="file-op-actions">';
          if (op.action !== 'delete' && op.content) {
            html += '<button class="file-op-btn" onclick="showDiff(' + msgIndex + ', ' + opIndex + ')">Diff</button>';
          }
          html += '<button class="file-op-btn primary" onclick="applyFile(' + msgIndex + ', ' + opIndex + ')">';
          html += op.action === 'delete' ? 'Delete' : 'Apply';
          html += '</button>';
          html += '</div>';
          html += '</div>';
        });

        html += '</div>';
      }

      // Add commands section if present
      if (msg.role === 'assistant' && msg.commands && msg.commands.length > 0) {
        html += '<div class="commands-section">';
        msg.commands.forEach((cmd, cmdIndex) => {
          html += '<div class="command-card">';
          html += '<div class="command-text">';
          html += '<code>' + escapeHtml(cmd.command) + '</code>';
          if (cmd.description) {
            html += '<div class="command-desc">' + escapeHtml(cmd.description) + '</div>';
          }
          html += '</div>';
          html += '<button class="run-cmd-btn" onclick="runCmd(' + msgIndex + ', ' + cmdIndex + ')">▶ Run</button>';
          html += '</div>';
        });
        html += '</div>';
      }

      div.innerHTML = html;
      return div;
    }

    // Store messages for later access
    let currentMessages = [];

    function applyFile(msgIndex, opIndex) {
      const msg = currentMessages[msgIndex];
      if (msg && msg.fileOperations && msg.fileOperations[opIndex]) {
        const op = msg.fileOperations[opIndex];
        vscode.postMessage({ type: 'applyFile', operation: op });

        // Update button to show "Applied"
        const card = document.getElementById('file-op-' + msgIndex + '-' + opIndex);
        if (card) {
          const btn = card.querySelector('.file-op-btn.primary');
          if (btn) {
            btn.textContent = '✓ Applied';
            btn.classList.add('applied');
            btn.onclick = null;
          }
        }
      }
    }

    function applyAllFiles(msgIndex) {
      const msg = currentMessages[msgIndex];
      if (msg && msg.fileOperations) {
        vscode.postMessage({ type: 'applyAllFiles', operations: msg.fileOperations });
      }
    }

    function showDiff(msgIndex, opIndex) {
      const msg = currentMessages[msgIndex];
      if (msg && msg.fileOperations && msg.fileOperations[opIndex]) {
        const op = msg.fileOperations[opIndex];
        vscode.postMessage({ type: 'showDiff', path: op.path, content: op.content });
      }
    }

    function runCmd(msgIndex, cmdIndex) {
      const msg = currentMessages[msgIndex];
      if (msg && msg.commands && msg.commands[cmdIndex]) {
        vscode.postMessage({ type: 'runCommand', command: msg.commands[cmdIndex] });
      }
    }

    function toggleThinking(el) {
      el.classList.toggle('collapsed');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatContent(content) {
      if (!content) return '';

      // Preserve code blocks first (replace with placeholders)
      const codeBlocks = [];
      let processed = content.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(match, lang, code) {
        codeBlocks.push('<pre><code>' + escapeHtml(code) + '</code></pre>');
        return '%%CODEBLOCK' + (codeBlocks.length - 1) + '%%';
      });

      // Preserve inline code
      const inlineCodes = [];
      processed = processed.replace(/\`([^\`]+)\`/g, function(match, code) {
        inlineCodes.push('<code>' + escapeHtml(code) + '</code>');
        return '%%INLINE' + (inlineCodes.length - 1) + '%%';
      });

      // Split into lines for block-level processing (handle both \\n and actual newlines)
      const lines = processed.split(/\\n|\\r\\n?/);
      const result = [];
      let inList = false;
      let listType = '';

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Headers (check longest first)
        if (/^####\\s+/.test(line)) {
          if (inList) { result.push('</' + listType + '>'); inList = false; }
          result.push('<h4>' + formatInline(line.replace(/^####\\s+/, '')) + '</h4>');
          continue;
        }
        if (/^###\\s+/.test(line)) {
          if (inList) { result.push('</' + listType + '>'); inList = false; }
          result.push('<h3>' + formatInline(line.replace(/^###\\s+/, '')) + '</h3>');
          continue;
        }
        if (/^##\\s+/.test(line)) {
          if (inList) { result.push('</' + listType + '>'); inList = false; }
          result.push('<h2>' + formatInline(line.replace(/^##\\s+/, '')) + '</h2>');
          continue;
        }
        if (/^#\\s+/.test(line)) {
          if (inList) { result.push('</' + listType + '>'); inList = false; }
          result.push('<h1>' + formatInline(line.replace(/^#\\s+/, '')) + '</h1>');
          continue;
        }

        // Horizontal rule
        if (/^-{3,}$/.test(line)) {
          if (inList) { result.push('</' + listType + '>'); inList = false; }
          result.push('<hr>');
          continue;
        }

        // Unordered list (- item or * item)
        if (/^[-*]\\s+/.test(line)) {
          if (!inList || listType !== 'ul') {
            if (inList) result.push('</' + listType + '>');
            result.push('<ul>');
            inList = true;
            listType = 'ul';
          }
          result.push('<li>' + formatInline(line.replace(/^[-*]\\s+/, '')) + '</li>');
          continue;
        }

        // Ordered list (1. item)
        if (/^\\d+\\.\\s+/.test(line)) {
          if (!inList || listType !== 'ol') {
            if (inList) result.push('</' + listType + '>');
            result.push('<ol>');
            inList = true;
            listType = 'ol';
          }
          result.push('<li>' + formatInline(line.replace(/^\\d+\\.\\s+/, '')) + '</li>');
          continue;
        }

        // Close list if we hit a non-list line
        if (inList && line.trim() !== '') {
          result.push('</' + listType + '>');
          inList = false;
        }

        // Empty line
        if (line.trim() === '') {
          if (inList) {
            result.push('</' + listType + '>');
            inList = false;
          }
          continue;
        }

        // Regular paragraph
        result.push('<p>' + formatInline(line) + '</p>');
      }

      // Close any open list
      if (inList) {
        result.push('</' + listType + '>');
      }

      let html = result.join('');

      // Restore code blocks and inline code
      for (let i = 0; i < codeBlocks.length; i++) {
        html = html.replace('%%CODEBLOCK' + i + '%%', codeBlocks[i]);
      }
      for (let i = 0; i < inlineCodes.length; i++) {
        html = html.replace('%%INLINE' + i + '%%', inlineCodes[i]);
      }

      return html;
    }

    function formatInline(text) {
      // Bold: **text** or __text__
      text = text.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
      text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

      // Italic: *text* or _text_
      text = text.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
      text = text.replace(/\\b_([^_]+)_\\b/g, '<em>$1</em>');

      return text;
    }

    window.addEventListener('message', event => {
      const data = event.data;

      switch (data.type) {
        case 'updateMessages':
          // Store messages for file operations access
          currentMessages = data.messages;

          if (data.messages.length > 0) {
            welcomeEl.style.display = 'none';
          } else {
            welcomeEl.style.display = 'flex';
          }

          const existing = messagesEl.querySelectorAll('.message, .error-message');
          existing.forEach(el => el.remove());

          data.messages.forEach((msg, msgIndex) => {
            messagesEl.insertBefore(renderMessage(msg, msgIndex), validatingEl);
          });

          messagesEl.scrollTop = messagesEl.scrollHeight;
          setStreamingState(false);
          break;

        case 'typing':
          typingEl.classList.toggle('show', data.isTyping);
          if (data.isTyping) {
            // Show streaming block when typing starts
            streamingEl.style.display = 'block';
            streamingThinkingEl.style.display = 'none';
            streamingThinkingContentEl.textContent = '';
            streamingContentEl.innerHTML = '';
            welcomeEl.style.display = 'none';
          }
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'streamThinking':
          streamingThinkingEl.style.display = 'block';
          streamingThinkingContentEl.textContent = data.thinking;
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'streamContent':
          streamingContentEl.innerHTML = formatContent(data.content);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'streamDone':
          // Hide streaming block - final message will be rendered by updateMessages
          streamingEl.style.display = 'none';
          break;

        case 'updateHealth':
          updateHealth(data.health, data.score);
          break;

        case 'updatePlan':
          updatePlan(data.plan);
          break;

        case 'showLogin':
          loginPromptEl.classList.add('show');
          messagesEl.style.display = 'none';
          break;

        case 'hideLogin':
          loginPromptEl.classList.remove('show');
          messagesEl.style.display = 'flex';
          break;

        case 'toolResult':
          const resultDiv = document.createElement('div');
          resultDiv.className = 'message assistant';
          resultDiv.innerHTML = '<strong>🔧 ' + data.tool + '</strong><br>' + formatContent(JSON.stringify(data.result, null, 2));
          messagesEl.insertBefore(resultDiv, validatingEl);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'validating':
          // Show validation indicator with TSC check
          validatingTextEl.textContent = 'Running TypeScript check...';
          validatingEl.classList.add('show');
          streamingEl.style.display = 'none';
          typingEl.classList.remove('show');
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'streamError':
          // Show error message
          validatingEl.classList.remove('show');
          streamingEl.style.display = 'none';
          typingEl.classList.remove('show');
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = '⚠️ ' + (data.error || 'An error occurred');
          messagesEl.insertBefore(errorDiv, validatingEl);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          setStreamingState(false);
          break;

        case 'requestCancelled':
          // Hide all progress indicators
          validatingEl.classList.remove('show');
          streamingEl.style.display = 'none';
          typingEl.classList.remove('show');
          setStreamingState(false);
          // Show cancelled message
          const cancelledDiv = document.createElement('div');
          cancelledDiv.className = 'message assistant';
          cancelledDiv.innerHTML = '<em>Request cancelled</em>';
          messagesEl.insertBefore(cancelledDiv, validatingEl);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
