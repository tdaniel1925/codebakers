import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

interface ChatResponse {
  content: string;
  projectUpdates?: {
    patterns?: string[];
    tasks?: string[];
    decisions?: Record<string, string>;
  };
}

interface Pattern {
  name: string;
  description: string;
  content: string;
}

export class CodeBakersClient {
  private anthropic: Anthropic | null = null;
  private sessionToken: string | null = null;
  private patterns: Map<string, Pattern> = new Map();
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  constructor(private readonly context: vscode.ExtensionContext) {
    // Load cached session token
    this.sessionToken = context.globalState.get('codebakers.sessionToken') || null;

    // Clean up corrupted tokens (URL-encoded or invalid)
    if (this.sessionToken && this.sessionToken.includes('%')) {
      console.log('CodeBakers: Clearing corrupted URL-encoded token');
      this.sessionToken = null;
      context.globalState.update('codebakers.sessionToken', undefined);
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    this.sessionToken = null;
    this.anthropic = null;
    await this.context.globalState.update('codebakers.sessionToken', undefined);
    await this.context.globalState.update('codebakers.user', undefined);
    vscode.window.showInformationMessage('Logged out of CodeBakers');
  }

  /**
   * Fetch with timeout to prevent hanging
   */
  private async _fetchWithTimeout(url: string, options: RequestInit = {}, timeout = this.DEFAULT_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if user has a valid session token (doesn't validate with server)
   */
  hasSessionToken(): boolean {
    return !!this.sessionToken;
  }

  /**
   * Handle OAuth callback from VS Code URI handler
   * Called when vscode://codebakers.codebakers/callback?token=xxx is received
   */
  async handleOAuthCallback(encodedToken: string): Promise<boolean> {
    try {
      console.log('handleOAuthCallback: token length:', encodedToken?.length);
      console.log('handleOAuthCallback: token preview:', encodedToken?.substring(0, 50));

      if (!encodedToken) {
        vscode.window.showErrorMessage('Login failed: No token received');
        return false;
      }

      // Try to decode the base64url token payload
      // The token might be URL-encoded, so try decoding that first
      let tokenToDecode = encodedToken;
      if (encodedToken.includes('%')) {
        tokenToDecode = decodeURIComponent(encodedToken);
        console.log('handleOAuthCallback: URL-decoded token');
      }

      // Decode base64url (supports both with and without padding)
      let decoded: string;
      try {
        decoded = Buffer.from(tokenToDecode, 'base64url').toString('utf-8');
      } catch {
        // Try standard base64 as fallback
        const base64 = tokenToDecode.replace(/-/g, '+').replace(/_/g, '/');
        decoded = Buffer.from(base64, 'base64').toString('utf-8');
      }

      console.log('handleOAuthCallback: decoded preview:', decoded?.substring(0, 100));

      const tokenPayload = JSON.parse(decoded) as {
        token: string;
        teamId: string;
        profileId: string;
        githubId: string;
        githubUsername: string;
        email: string;
        plan: string;
        trial: { endsAt: string; daysRemaining: number } | null;
        createdAt: string;
      };

      // Store session token (the decoded base64url payload, not URL-encoded)
      // If the token was URL-encoded, we need to store the decoded version
      const cleanToken = encodedToken.includes('%') ? decodeURIComponent(encodedToken) : encodedToken;
      this.sessionToken = cleanToken;
      await this.context.globalState.update('codebakers.sessionToken', cleanToken);

      // Store auth info for display
      this.currentPlan = tokenPayload.plan;
      this.trialInfo = tokenPayload.trial;
      this.isUnlimited = tokenPayload.plan === 'pro';

      // Store additional user info
      await this.context.globalState.update('codebakers.user', {
        teamId: tokenPayload.teamId,
        profileId: tokenPayload.profileId,
        githubUsername: tokenPayload.githubUsername,
        email: tokenPayload.email,
      });

      // Initialize Anthropic client with our API key
      await this._initializeAnthropic();

      vscode.window.showInformationMessage(
        `Welcome to CodeBakers, @${tokenPayload.githubUsername}! ${tokenPayload.trial ? `Trial: ${tokenPayload.trial.daysRemaining} days remaining` : ''}`
      );

      return true;
    } catch (e) {
      console.error('Failed to handle OAuth callback:', e);
      console.error('Token was:', encodedToken?.substring(0, 100));
      vscode.window.showErrorMessage(`Login failed: ${e instanceof Error ? e.message : 'Invalid token'}`);
      return false;
    }
  }

  async checkAuth(): Promise<boolean> {
    if (!this.sessionToken) return false;

    try {
      const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/auth/check`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      }, 5000); // 5 second timeout for auth check
      return response.ok;
    } catch {
      return false;
    }
  }

  async login(): Promise<boolean> {
    // Open browser to CodeBakers login
    // The callback will be handled by the global URI handler in extension.ts
    const callbackUri = await vscode.env.asExternalUri(
      vscode.Uri.parse(`${vscode.env.uriScheme}://codebakers.codebakers/callback`)
    );

    const loginUrl = `${this._getApiEndpoint()}/vscode-login?callback=${encodeURIComponent(callbackUri.toString())}`;

    vscode.env.openExternal(vscode.Uri.parse(loginUrl));

    // Return true to indicate login was initiated
    // The actual login completion is handled by handleOAuthCallback
    return true;
  }

  private currentPlan: string = 'trial';
  private isUnlimited: boolean = false;
  private trialInfo: { endsAt: string; daysRemaining: number } | null = null;

  private async _initializeAnthropic(): Promise<void> {
    // Get API key from our server (user's CodeBakers subscription includes Claude access)
    try {
      console.log('_initializeAnthropic: sessionToken exists:', !!this.sessionToken);
      console.log('_initializeAnthropic: sessionToken length:', this.sessionToken?.length);
      console.log('_initializeAnthropic: sessionToken preview:', this.sessionToken?.substring(0, 50));
      console.log('_initializeAnthropic: contains %:', this.sessionToken?.includes('%'));

      // Verify token can be decoded
      if (this.sessionToken) {
        try {
          const decoded = Buffer.from(this.sessionToken, 'base64url').toString('utf-8');
          const parsed = JSON.parse(decoded);
          console.log('_initializeAnthropic: token decoded successfully, teamId:', parsed.teamId);
        } catch (e) {
          console.error('_initializeAnthropic: FAILED to decode token locally:', e);
        }
      }

      // Use plain object for headers (more compatible)
      const authHeader = `Bearer ${this.sessionToken}`;
      console.log('_initializeAnthropic: authHeader length:', authHeader.length);
      console.log('_initializeAnthropic: authHeader preview:', authHeader.substring(0, 60));

      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      };

      console.log('_initializeAnthropic: fetchOptions.headers:', JSON.stringify(fetchOptions.headers));

      const url = `${this._getApiEndpoint()}/api/claude/key`;
      console.log('_initializeAnthropic: fetching:', url);

      const response = await this._fetchWithTimeout(url, fetchOptions);

      interface ClaudeKeyResponse {
        apiKey?: string;
        plan?: string;
        unlimited?: boolean;
        trial?: { endsAt: string; daysRemaining: number };
        error?: string;
        message?: string;
        upgradeUrl?: string;
        trialUrl?: string;
      }

      const data = await response.json() as ClaudeKeyResponse;

      console.log('Claude key response:', response.status, JSON.stringify(data));

      // Handle subscription required error
      if (response.status === 402) {
        const selection = await vscode.window.showWarningMessage(
          data.message || 'Subscribe to CodeBakers Pro ($99/month) for unlimited access',
          'Subscribe Now',
          'Start Free Trial'
        );

        if (selection === 'Subscribe Now') {
          vscode.env.openExternal(vscode.Uri.parse(data.upgradeUrl || 'https://www.codebakers.ai/dashboard/billing'));
        } else if (selection === 'Start Free Trial') {
          vscode.env.openExternal(vscode.Uri.parse(data.trialUrl || 'https://www.codebakers.ai/dashboard/billing'));
        }

        throw new Error('SUBSCRIPTION_REQUIRED');
      }

      if (!response.ok) {
        console.error('API error response:', JSON.stringify(data));
        // Include token info in error for debugging
        const tokenInfo = this.sessionToken
          ? `token len=${this.sessionToken.length}, starts=${this.sessionToken.substring(0,10)}`
          : 'NO TOKEN';
        throw new Error(`API ${response.status}: ${data.error || data.message || 'Unknown'} [${tokenInfo}]`);
      }

      if (!data.apiKey) {
        throw new Error(`No API key in response: ${JSON.stringify(data)}`);
      }

      const { apiKey, plan, unlimited, trial } = data;

      // Store plan info
      this.currentPlan = plan || 'trial';
      this.isUnlimited = unlimited || false;
      this.trialInfo = trial || null;

      // Show trial warning if applicable
      if (trial && trial.daysRemaining <= 3) {
        vscode.window.showWarningMessage(
          `Your CodeBakers trial expires in ${trial.daysRemaining} day${trial.daysRemaining === 1 ? '' : 's'}. Subscribe to keep using the extension.`,
          'Subscribe Now'
        ).then(selection => {
          if (selection === 'Subscribe Now') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.codebakers.ai/dashboard/billing'));
          }
        });
      }

      this.anthropic = new Anthropic({ apiKey });

      // Also fetch patterns
      await this._loadPatterns();
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
      throw error;
    }
  }

  /**
   * Get current plan info for display
   */
  getPlanInfo(): { plan: string; unlimited: boolean; trial: { endsAt: string; daysRemaining: number } | null } {
    return {
      plan: this.currentPlan,
      unlimited: this.isUnlimited,
      trial: this.trialInfo,
    };
  }

  private async _loadPatterns(): Promise<void> {
    try {
      const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/patterns/list`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`
        }
      }, 15000); // 15 seconds for pattern loading

      if (response.ok) {
        const data = await response.json() as { patterns?: Pattern[] };
        if (data.patterns) {
          data.patterns.forEach((p: Pattern) => this.patterns.set(p.name, p));
        }
      }
    } catch (error) {
      console.error('Failed to load patterns:', error);
    }
  }

  async chat(messages: any[], projectState: any): Promise<ChatResponse> {
    if (!this.anthropic) {
      await this._initializeAnthropic();
    }

    if (!this.anthropic) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Build the system prompt with CodeBakers enforcement
    const systemPrompt = this._buildSystemPrompt(projectState);

    // Detect which patterns might be relevant based on the conversation
    const relevantPatterns = await this._detectRelevantPatterns(messages);

    // Include pattern content in system prompt
    const patternsContent = relevantPatterns
      .map(p => `## Pattern: ${p.name}\n${p.content}`)
      .join('\n\n');

    const fullSystemPrompt = `${systemPrompt}\n\n# LOADED PATTERNS\n${patternsContent}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192, // Unlimited plan - generous output
        system: fullSystemPrompt,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      });

      const content = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      // Parse any project updates from the response
      const projectUpdates = this._extractProjectUpdates(content);

      // Append footer
      const contentWithFooter = content + '\n\n---\n🍪 **CodeBakers Active** | Patterns: ' +
        relevantPatterns.map(p => p.name).join(', ') + ' | v6.12';

      return {
        content: contentWithFooter,
        projectUpdates
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  async summarize(text: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Not authenticated');
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a conversation summarizer. Create concise summaries that preserve key decisions, code changes, and context. Be specific about file names and technical decisions.',
      messages: [{
        role: 'user',
        content: text
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  async getAvailablePatterns(): Promise<Pattern[]> {
    return Array.from(this.patterns.values());
  }

  // ==========================================
  // TOOL EXECUTION (All MCP tools available)
  // ==========================================

  /**
   * Execute any CodeBakers tool
   */
  async executeTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/tools`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: toolName,
        args,
        projectPath,
      }),
    }, 30000); // 30 seconds for tool execution

    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      throw new Error(errorData.message || `Tool execution failed: ${toolName}`);
    }

    return response.json();
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<Array<{ name: string; category: string }>> {
    if (!this.sessionToken) {
      return [];
    }

    const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/tools`, {
      headers: {
        'Authorization': `Bearer ${this.sessionToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tools');
    }

    const data = await response.json() as { data: { tools: Array<{ name: string; category: string }> } };
    return data.data?.tools || [];
  }

  // Convenience methods for common tools

  async discoverPatterns(task: string, keywords: string[] = []): Promise<any> {
    return this.executeTool('discover_patterns', { task, keywords });
  }

  async validateComplete(feature: string, files: string[]): Promise<any> {
    return this.executeTool('validate_complete', { feature, files });
  }

  async guardianAnalyze(files: string[]): Promise<any> {
    return this.executeTool('guardian_analyze', { files });
  }

  async guardianHeal(issues: any[]): Promise<any> {
    return this.executeTool('guardian_heal', { issues });
  }

  async guardianVerify(): Promise<any> {
    return this.executeTool('guardian_verify', {});
  }

  async guardianStatus(): Promise<any> {
    return this.executeTool('guardian_status', {});
  }

  async rippleCheck(entityName: string, changeType?: string): Promise<any> {
    return this.executeTool('ripple_check', { entityName, changeType });
  }

  async runAudit(): Promise<any> {
    return this.executeTool('run_audit', {});
  }

  async runTests(): Promise<any> {
    return this.executeTool('run_tests', {});
  }

  async detectIntent(message: string): Promise<any> {
    return this.executeTool('detect_intent', { message });
  }

  private _buildSystemPrompt(projectState: any): string {
    return `# CodeBakers AI Pattern System
Version: 6.12

You are CodeBakers, an AI coding assistant that ALWAYS uses production-ready patterns.

## MANDATORY RULES (Cannot be skipped)

1. **ALWAYS use patterns** - Never write code from memory when a pattern exists
2. **ALWAYS show footer** - End every code response with the CodeBakers footer
3. **ALWAYS write tests** - Every feature includes tests, no exceptions
4. **ALWAYS handle errors** - Use try/catch, validation, and proper error responses

## TWO-GATE ENFORCEMENT

Before writing code:
1. Check which patterns apply to this task
2. Load and follow those patterns exactly

Before saying "done":
1. Verify tests exist and pass
2. Verify TypeScript compiles
3. Verify error handling is in place

## CURRENT PROJECT STATE
${projectState ? JSON.stringify(projectState, null, 2) : 'No project state loaded'}

## RESPONSE FORMAT

After any code generation, include this footer:
---
🍪 **CodeBakers Active** | Patterns: [list patterns used] | v6.12

## CRITICAL
- You CANNOT skip patterns even if user asks for "quick" code
- You CANNOT skip tests even if user says "I'll add them later"
- You MUST show the footer on every response with code
`;
  }

  private async _detectRelevantPatterns(messages: any[]): Promise<Pattern[]> {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const relevant: Pattern[] = [];

    // Keyword-based pattern detection
    const keywordMap: Record<string, string[]> = {
      '00-core': ['any', 'code', 'build', 'create'],
      '01-database': ['database', 'db', 'schema', 'table', 'query', 'drizzle', 'postgres'],
      '02-auth': ['auth', 'login', 'signup', 'session', 'password', 'oauth'],
      '03-api': ['api', 'route', 'endpoint', 'rest', 'fetch'],
      '04-frontend': ['component', 'react', 'form', 'ui', 'page'],
      '05-payments': ['payment', 'stripe', 'billing', 'subscription', 'checkout'],
      '08-testing': ['test', 'testing', 'playwright', 'vitest'],
    };

    // Always include core
    if (this.patterns.has('00-core')) {
      relevant.push(this.patterns.get('00-core')!);
    }

    // Add relevant patterns based on keywords
    for (const [pattern, keywords] of Object.entries(keywordMap)) {
      if (pattern === '00-core') continue;

      if (keywords.some(kw => lastMessage.includes(kw))) {
        const p = this.patterns.get(pattern);
        if (p) relevant.push(p);
      }
    }

    return relevant;
  }

  private _extractProjectUpdates(content: string): ChatResponse['projectUpdates'] {
    // Extract any structured updates from the response
    // This is a simple implementation - could be enhanced with XML tags in prompt
    const updates: ChatResponse['projectUpdates'] = {};

    // Look for patterns like "Added pattern: X"
    const patternMatches = content.match(/(?:using|loaded|applied) pattern[s]?: ([^\n]+)/gi);
    if (patternMatches) {
      updates.patterns = patternMatches.flatMap(m =>
        m.split(':')[1]?.split(',').map(s => s.trim()) || []
      );
    }

    return Object.keys(updates).length > 0 ? updates : undefined;
  }

  private _getApiEndpoint(): string {
    return vscode.workspace.getConfiguration('codebakers').get('apiEndpoint', 'https://www.codebakers.ai');
  }
}
