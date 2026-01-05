"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
class ChatViewProvider {
    constructor(context, client, projectContext) {
        this.context = context;
        this.client = client;
        this.projectContext = projectContext;
        this._messages = [];
        this._conversationSummary = '';
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
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
            }
        });
        // Initialize plan and health on load (non-blocking)
        this._initializeStatus();
    }
    async _initializeStatus() {
        if (!this._view)
            return;
        try {
            // Get plan info (sync, always works)
            const planInfo = this.client.getPlanInfo();
            this._view.webview.postMessage({
                type: 'updatePlan',
                plan: planInfo.plan
            });
            // Only try to get health if user is logged in
            if (!this.client.hasSessionToken()) {
                // Show default health for non-logged in users
                this._view.webview.postMessage({
                    type: 'updateHealth',
                    health: 0,
                    score: 0
                });
                return;
            }
            // Get health status (async, might fail - that's OK)
            try {
                const health = await this.client.guardianStatus();
                this._view.webview.postMessage({
                    type: 'updateHealth',
                    health: health.data?.health || 85,
                    score: health.data?.health || 85
                });
            }
            catch (healthError) {
                // Health check failed - show default
                console.warn('Health check failed:', healthError);
                this._view.webview.postMessage({
                    type: 'updateHealth',
                    health: 85,
                    score: 85
                });
            }
        }
        catch (error) {
            console.error('Failed to initialize status:', error);
        }
    }
    async _executeTool(toolName) {
        if (!this._view)
            return;
        try {
            this._view.webview.postMessage({ type: 'typing', isTyping: true });
            const result = await this.client.executeTool(toolName, {});
            this._view.webview.postMessage({
                type: 'toolResult',
                tool: toolName,
                result: result.data || result
            });
            // If it's a health check, update the health bar
            if (toolName === 'guardian_status' && result.data?.health) {
                this._view.webview.postMessage({
                    type: 'updateHealth',
                    health: result.data.health,
                    score: result.data.health
                });
            }
        }
        catch (error) {
            this._view.webview.postMessage({
                type: 'toolResult',
                tool: toolName,
                result: { error: error instanceof Error ? error.message : 'Tool execution failed' }
            });
        }
        finally {
            this._view?.webview.postMessage({ type: 'typing', isTyping: false });
        }
    }
    async sendMessage(userMessage) {
        if (!this._view)
            return;
        // Add user message to history
        this._messages.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        });
        this._updateWebview();
        try {
            // Show typing indicator
            this._view.webview.postMessage({ type: 'typing', isTyping: true });
            // Get project context for perfect recall
            const projectState = await this.projectContext.getProjectState();
            // Build the context-aware prompt
            const contextualizedMessages = await this._buildContextualizedMessages(userMessage, projectState);
            // Call Claude via our API (with pattern enforcement)
            const response = await this.client.chat(contextualizedMessages, projectState);
            // Add assistant response
            this._messages.push({
                role: 'assistant',
                content: response.content,
                timestamp: new Date()
            });
            // Update project context with any new information
            if (response.projectUpdates) {
                await this.projectContext.applyUpdates(response.projectUpdates);
            }
            // Check if we need to summarize (context getting large)
            if (this._messages.length > 20) {
                await this._summarizeConversation();
            }
        }
        catch (error) {
            this._messages.push({
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date()
            });
        }
        finally {
            this._view?.webview.postMessage({ type: 'typing', isTyping: false });
            this._updateWebview();
        }
    }
    async _buildContextualizedMessages(userMessage, projectState) {
        const messages = [];
        // Always include summary if we have one (perfect recall)
        if (this._conversationSummary) {
            messages.push({
                role: 'system',
                content: `Previous conversation summary:\n${this._conversationSummary}`
            });
        }
        // Include relevant project context
        if (projectState) {
            messages.push({
                role: 'system',
                content: `Current project state:\n${JSON.stringify(projectState, null, 2)}`
            });
        }
        // Include recent messages (last 10 for context)
        const recentMessages = this._messages.slice(-10);
        for (const msg of recentMessages) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }
        return messages;
    }
    async _summarizeConversation() {
        // Summarize older messages to maintain context without using all tokens
        const oldMessages = this._messages.slice(0, -10);
        if (oldMessages.length === 0)
            return;
        const summaryPrompt = `Summarize these conversation messages, keeping key decisions and context:\n${oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;
        try {
            const summary = await this.client.summarize(summaryPrompt);
            this._conversationSummary = summary;
            // Keep only recent messages
            this._messages = this._messages.slice(-10);
        }
        catch (error) {
            console.error('Failed to summarize conversation:', error);
        }
    }
    _updateWebview() {
        if (!this._view)
            return;
        this._view.webview.postMessage({
            type: 'updateMessages',
            messages: this._messages.map(m => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp.toISOString()
            }))
        });
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers Chat</title>
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
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-icon {
      font-size: 20px;
    }

    .header-title {
      font-weight: 600;
      flex: 1;
    }

    .clear-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .clear-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 90%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
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
    }

    .message code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }

    .typing-indicator {
      display: none;
      align-self: flex-start;
      padding: 10px 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 12px;
    }

    .typing-indicator.show {
      display: flex;
      gap: 4px;
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

    .input-area {
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }

    .input-area textarea {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 10px 12px;
      font-family: inherit;
      font-size: inherit;
      resize: none;
      min-height: 40px;
      max-height: 120px;
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
      padding: 0 16px;
      cursor: pointer;
      font-weight: 500;
    }

    .send-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .footer {
      padding: 8px 12px;
      text-align: center;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border);
    }

    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }

    .welcome-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .welcome-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .welcome-text {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
    }

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

    .health-bar {
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
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

    .tools-bar {
      padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tool-chip {
      font-size: 10px;
      padding: 4px 8px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 12px;
      cursor: pointer;
    }

    .tool-chip:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .tool-chip.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
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
  </style>
</head>
<body>
  <div class="header">
    <span class="header-icon">🍪</span>
    <span class="header-title">CodeBakers</span>
    <span class="plan-badge" id="planBadge">Pro</span>
    <button class="clear-btn" onclick="clearChat()">Clear</button>
  </div>

  <div class="health-bar" id="healthBar">
    <div class="health-indicator" id="healthIndicator"></div>
    <span class="health-text">Project Health</span>
    <span class="health-score" id="healthScore">--</span>
  </div>

  <div class="messages" id="messages">
    <div class="welcome" id="welcome">
      <span class="welcome-icon">🍪</span>
      <div class="welcome-title">Welcome to CodeBakers</div>
      <div class="welcome-text">AI-powered coding with production-ready patterns</div>
      <div class="quick-actions">
        <button class="quick-action" onclick="quickAction('/build')">🔨 Build Project</button>
        <button class="quick-action" onclick="quickAction('/feature')">✨ Add Feature</button>
        <button class="quick-action" onclick="quickAction('/audit')">🔍 Audit Code</button>
        <button class="quick-action" onclick="runTool('guardian_status')">🛡️ Health Check</button>
      </div>
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
  </div>

  <div class="footer">
    Powered by CodeBakers — a BotMakers Software
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const typingEl = document.getElementById('typing');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');

    function sendMessage() {
      const message = inputEl.value.trim();
      if (!message) return;

      vscode.postMessage({ type: 'sendMessage', message });
      inputEl.value = '';
      inputEl.style.height = 'auto';
      sendBtn.disabled = true;
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
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    function renderMessage(msg) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;
      div.innerHTML = formatContent(msg.content);
      return div;
    }

    function formatContent(content) {
      // Simple markdown-like formatting
      return content
        .replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\\n/g, '<br>');
    }

    window.addEventListener('message', event => {
      const data = event.data;

      switch (data.type) {
        case 'updateMessages':
          // Hide welcome, show messages
          if (data.messages.length > 0) {
            welcomeEl.style.display = 'none';
          } else {
            welcomeEl.style.display = 'flex';
          }

          // Clear and re-render messages
          const existing = messagesEl.querySelectorAll('.message');
          existing.forEach(el => el.remove());

          data.messages.forEach(msg => {
            messagesEl.insertBefore(renderMessage(msg), typingEl);
          });

          // Scroll to bottom
          messagesEl.scrollTop = messagesEl.scrollHeight;
          sendBtn.disabled = false;
          break;

        case 'typing':
          typingEl.classList.toggle('show', data.isTyping);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;

        case 'updateHealth':
          updateHealth(data.health, data.score);
          break;

        case 'updatePlan':
          updatePlan(data.plan);
          break;

        case 'toolResult':
          // Show tool result as a message
          const resultDiv = document.createElement('div');
          resultDiv.className = 'message assistant';
          resultDiv.innerHTML = '<strong>🔧 ' + data.tool + '</strong><br>' + formatContent(JSON.stringify(data.result, null, 2));
          messagesEl.insertBefore(resultDiv, typingEl);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.ChatViewProvider = ChatViewProvider;
//# sourceMappingURL=ChatViewProvider.js.map