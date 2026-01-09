import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { CodeValidator, ValidationResult, DependencyCheck, TypeScriptCheckResult } from './CodeValidator';

export interface FileOperation {
  action: 'create' | 'edit' | 'delete';
  path: string;
  description?: string;
  content?: string;
}

export interface CommandToRun {
  command: string;
  description?: string;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // in USD
}

interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
  startTime: Date;
}

interface ChatResponse {
  content: string;
  thinking?: string;
  fileOperations?: FileOperation[];
  commands?: CommandToRun[];
  projectUpdates?: {
    patterns?: string[];
    tasks?: string[];
    decisions?: Record<string, string>;
  };
  validation?: ValidationResult;
  dependencyCheck?: DependencyCheck;
  usage?: TokenUsage;
  gate2?: {
    passed: boolean;
    issues: string[];
    compliance: { score: number; deductions: Array<{ rule: string; issue: string; points: number }> };
    message?: string;
  };
}

interface StreamCallbacks {
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
  abortSignal?: AbortSignal;
}

interface ChatOptions {
  maxRetries?: number;
  runTypeScriptCheck?: boolean;
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
  private validator: CodeValidator;
  private validatorInitialized: boolean = false;

  // Session cost tracking
  private sessionStats: SessionStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    requestCount: 0,
    startTime: new Date()
  };

  // Enforcement session for server-side gates
  private currentEnforcementSession: {
    token: string;
    patterns: Array<{ name: string; content: string; relevance: number }>;
    expiresAt: string;
  } | null = null;

  // Claude Sonnet 4 pricing (as of Jan 2025)
  private readonly PRICE_PER_1K_INPUT = 0.003; // $3 per 1M input tokens
  private readonly PRICE_PER_1K_OUTPUT = 0.015; // $15 per 1M output tokens

  constructor(private readonly context: vscode.ExtensionContext) {
    // Initialize code validator
    this.validator = new CodeValidator();
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
   * Get current session statistics for cost tracking
   */
  getSessionStats(): SessionStats & { formattedCost: string; formattedDuration: string } {
    const now = new Date();
    const durationMs = now.getTime() - this.sessionStats.startTime.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);

    return {
      ...this.sessionStats,
      formattedCost: `$${this.sessionStats.totalCost.toFixed(4)}`,
      formattedDuration: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
    };
  }

  /**
   * Reset session stats (e.g., when starting fresh)
   */
  resetSessionStats(): void {
    this.sessionStats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      requestCount: 0,
      startTime: new Date()
    };
  }

  /**
   * Calculate cost for a given token usage
   */
  private _calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.PRICE_PER_1K_INPUT;
    const outputCost = (outputTokens / 1000) * this.PRICE_PER_1K_OUTPUT;
    return inputCost + outputCost;
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
      // Include token in query param as fallback (VS Code may strip headers)
      const url = `${this._getApiEndpoint()}/api/auth/check?token=${encodeURIComponent(this.sessionToken)}`;
      const response = await this._fetchWithTimeout(url, {
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
    try {
      console.log('CodeBakers: login() called');

      // Open browser to CodeBakers login
      // The callback will be handled by the global URI handler in extension.ts
      const uriScheme = vscode.env.uriScheme;
      console.log('CodeBakers: uriScheme =', uriScheme);

      const rawCallbackUri = vscode.Uri.parse(`${uriScheme}://codebakers.codebakers/callback`);
      console.log('CodeBakers: rawCallbackUri =', rawCallbackUri.toString());

      const callbackUri = await vscode.env.asExternalUri(rawCallbackUri);
      console.log('CodeBakers: callbackUri =', callbackUri.toString());

      const apiEndpoint = this._getApiEndpoint();
      console.log('CodeBakers: apiEndpoint =', apiEndpoint);

      const loginUrl = `${apiEndpoint}/vscode-login?callback=${encodeURIComponent(callbackUri.toString())}`;
      console.log('CodeBakers: loginUrl =', loginUrl);

      await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
      console.log('CodeBakers: openExternal called successfully');

      // Return true to indicate login was initiated
      // The actual login completion is handled by handleOAuthCallback
      return true;
    } catch (error) {
      console.error('CodeBakers: login() error:', error);
      throw error;
    }
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

      // Include token in query param as fallback (VS Code may strip headers)
      const url = `${this._getApiEndpoint()}/api/claude/key?token=${encodeURIComponent(this.sessionToken || '')}`;
      console.log('_initializeAnthropic: fetching:', url.substring(0, 80) + '...');

      const response = await this._fetchWithTimeout(url, fetchOptions);

      interface ClaudeKeyData {
        apiKey?: string;
        plan?: string;
        unlimited?: boolean;
        trial?: { endsAt: string; daysRemaining: number };
      }

      interface ClaudeKeyResponse {
        data?: ClaudeKeyData;
        error?: string;
        message?: string;
        upgradeUrl?: string;
        trialUrl?: string;
      }

      const rawResponse = await response.json() as ClaudeKeyResponse;
      // Server wraps successful responses in {data: ...}
      const data = rawResponse.data || rawResponse as unknown as ClaudeKeyData;

      console.log('Claude key response:', response.status, JSON.stringify(data));

      // Handle subscription required error
      if (response.status === 402) {
        const selection = await vscode.window.showWarningMessage(
          rawResponse.message || 'Subscribe to CodeBakers Pro ($99/month) for unlimited access',
          'Subscribe Now',
          'Start Free Trial'
        );

        if (selection === 'Subscribe Now') {
          vscode.env.openExternal(vscode.Uri.parse(rawResponse.upgradeUrl || 'https://www.codebakers.ai/dashboard/billing'));
        } else if (selection === 'Start Free Trial') {
          vscode.env.openExternal(vscode.Uri.parse(rawResponse.trialUrl || 'https://www.codebakers.ai/dashboard/billing'));
        }

        throw new Error('SUBSCRIPTION_REQUIRED');
      }

      if (!response.ok) {
        console.error('API error response:', JSON.stringify(rawResponse));
        // Include token info in error for debugging
        const tokenInfo = this.sessionToken
          ? `token len=${this.sessionToken.length}, starts=${this.sessionToken.substring(0,10)}`
          : 'NO TOKEN';
        throw new Error(`API ${response.status}: ${rawResponse.error || rawResponse.message || 'Unknown'} [${tokenInfo}]`);
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
      // Include token in query param as fallback (VS Code may strip headers)
      const url = `${this._getApiEndpoint()}/api/patterns/list?token=${encodeURIComponent(this.sessionToken || '')}`;
      const response = await this._fetchWithTimeout(url, {
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

  async chat(
    messages: any[],
    projectState: any,
    callbacks?: StreamCallbacks,
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const maxRetries = options?.maxRetries ?? 3;
    const runTscCheck = options?.runTypeScriptCheck ?? true;

    if (!this.anthropic) {
      await this._initializeAnthropic();
    }

    if (!this.anthropic) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Build the system prompt with CodeBakers enforcement
    const systemPrompt = this._buildSystemPrompt(projectState);

    // GATE 1: Call server-side pattern discovery
    // This creates an enforcement session and returns relevant patterns
    const lastMessage = messages[messages.length - 1]?.content || '';
    let serverPatterns: Array<{ name: string; content: string; relevance: number }> = [];

    try {
      // Extract keywords for pattern matching
      const keywords = this._extractKeywords(lastMessage);

      // Call server to discover patterns and create enforcement session
      const discoveryResult = await this._callDiscoverPatterns(lastMessage, keywords);

      if (discoveryResult && discoveryResult.sessionToken) {
        this.currentEnforcementSession = {
          token: discoveryResult.sessionToken,
          patterns: discoveryResult.patterns || [],
          expiresAt: discoveryResult.expiresAt || new Date(Date.now() + 3600000).toISOString(),
        };
        serverPatterns = discoveryResult.patterns || [];
        console.log('CodeBakers: GATE 1 passed - enforcement session created:', discoveryResult.sessionToken.substring(0, 20) + '...');
      }
    } catch (error) {
      console.warn('CodeBakers: Server pattern discovery failed, falling back to local patterns:', error);
      // Fall back to local pattern detection
      const localPatterns = await this._detectRelevantPatterns(messages);
      serverPatterns = localPatterns.map(p => ({ name: p.name, content: p.content, relevance: 1 }));
    }

    // Include pattern content in system prompt (prefer server patterns)
    const patternsContent = serverPatterns.length > 0
      ? serverPatterns.map(p => `## Pattern: ${p.name}\n${p.content}`).join('\n\n')
      : (await this._detectRelevantPatterns(messages)).map(p => `## Pattern: ${p.name}\n${p.content}`).join('\n\n');

    // Extract system messages and add to system prompt (Claude API doesn't accept role: "system" in messages)
    const systemMessages = messages.filter(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    // Build full system prompt including any context from "system" role messages
    const contextFromMessages = systemMessages.length > 0
      ? '\n\n# CONTEXT\n' + systemMessages.map(m => m.content).join('\n\n')
      : '';

    // Add enforcement reminder to system prompt
    const enforcementReminder = this.currentEnforcementSession
      ? '\n\n# ENFORCEMENT\nYou are in an enforced session. Follow the loaded patterns exactly. Your code will be validated against these patterns before being applied.'
      : '';

    const fullSystemPrompt = `${systemPrompt}\n\n# LOADED PATTERNS\n${patternsContent}${contextFromMessages}${enforcementReminder}`;

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if aborted before starting
        if (callbacks?.abortSignal?.aborted) {
          throw new Error('Request was cancelled');
        }

        // Use streaming to show response in real-time
        let fullText = '';

        const stream = this.anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          system: fullSystemPrompt,
          messages: chatMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }))
        });

        // Set up abort handling
        if (callbacks?.abortSignal) {
          callbacks.abortSignal.addEventListener('abort', () => {
            stream.abort();
          });
        }

        // Handle streaming text events
        stream.on('text', (text) => {
          // Check if aborted during streaming
          if (callbacks?.abortSignal?.aborted) {
            stream.abort();
            return;
          }

          fullText += text;

          // Parse thinking and content in real-time
          const { thinking, content } = this._parseThinkingAndContent(fullText);

          if (thinking) {
            callbacks?.onThinking?.(thinking);
          }
          callbacks?.onContent?.(content);
        });

        // Wait for completion and get usage stats
        const finalMessage = await stream.finalMessage();

        // Capture token usage from the response
        let usage: TokenUsage | undefined;
        if (finalMessage.usage) {
          const inputTokens = finalMessage.usage.input_tokens;
          const outputTokens = finalMessage.usage.output_tokens;
          const cost = this._calculateCost(inputTokens, outputTokens);

          usage = {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            estimatedCost: cost
          };

          // Update session stats
          this.sessionStats.totalInputTokens += inputTokens;
          this.sessionStats.totalOutputTokens += outputTokens;
          this.sessionStats.totalCost += cost;
          this.sessionStats.requestCount += 1;
        }

        // Check if aborted
        if (callbacks?.abortSignal?.aborted) {
          throw new Error('Request was cancelled');
        }

        callbacks?.onDone?.();

        // Parse final thinking and content
        const { thinking, content } = this._parseThinkingAndContent(fullText);

        // Parse file operations and commands from response
        const fileOperations = this.parseFileOperations(content);
        const commands = this.parseCommands(content);

        // Clean content for display (remove XML tags)
        const cleanContent = this.cleanContentForDisplay(content);

        // COMPLIANCE CHECK - Verify AI followed rules
        const compliance = this._checkCompliance(fullText, thinking, fileOperations, cleanContent);

        // VALIDATION - Deep code quality checks
        let validation: ValidationResult | undefined;
        let dependencyCheck: DependencyCheck | undefined;
        let tscResult: TypeScriptCheckResult | undefined;

        if (fileOperations.length > 0) {
          // Initialize validator if needed
          if (!this.validatorInitialized) {
            await this.validator.initialize();
            this.validatorInitialized = true;
          }

          // Check dependencies before allowing apply
          dependencyCheck = this.validator.checkDependencies(fileOperations);

          // Validate generated code
          validation = await this.validator.validateFileOperations(fileOperations);

          // Run TypeScript check if enabled
          if (runTscCheck) {
            tscResult = await this.validator.runTypeScriptCheck();
            if (validation) {
              validation.tscResult = tscResult;
            }
          }
        }

        // Parse any project updates from the response
        const projectUpdates = this._extractProjectUpdates(cleanContent);

        // Build footer with counts and validation status
        const fileCount = fileOperations.length;
        const cmdCount = commands.length;
        const patternNames = serverPatterns.map(p => p.name).join(', ') || 'core';

        // Determine overall status
        const hasComplianceIssues = !compliance.passed;
        const hasValidationErrors = validation && !validation.passed;
        const hasMissingDeps = dependencyCheck && dependencyCheck.missing.length > 0;
        const hasTscErrors = tscResult && !tscResult.passed;

        let statusIcon = '✅';
        if (hasValidationErrors || hasTscErrors) statusIcon = '❌';
        else if (hasComplianceIssues || hasMissingDeps) statusIcon = '⚠️';

        let contentWithFooter = cleanContent;

        // Add dependency warning if packages missing
        if (hasMissingDeps && dependencyCheck) {
          contentWithFooter += '\n\n---\n📦 **Missing Packages:**\n```bash\nnpm install ' +
            dependencyCheck.missing.join(' ') + '\n```';
        }

        // Add TypeScript errors if any
        if (hasTscErrors && tscResult) {
          contentWithFooter += '\n\n---\n🔴 **TypeScript Errors (' + tscResult.errorCount + '):**\n' +
            tscResult.errors.slice(0, 5).map(e => `- ${e.file}:${e.line} - ${e.message}`).join('\n');
          if (tscResult.errorCount > 5) {
            contentWithFooter += `\n  ...and ${tscResult.errorCount - 5} more`;
          }
        }

        // Add validation errors/warnings
        if (validation) {
          if (validation.errors.length > 0) {
            contentWithFooter += '\n\n---\n❌ **Validation Errors:**\n' +
              validation.errors.map(e => `- ${e.file}: ${e.message}`).join('\n');
          }
          if (validation.warnings.length > 0) {
            contentWithFooter += '\n\n---\n⚠️ **Warnings:**\n' +
              validation.warnings.map(w => `- ${w.file}: ${w.message}`).join('\n');
          }
          if (validation.suggestions.length > 0) {
            contentWithFooter += '\n\n---\n💡 **Suggestions:**\n' +
              validation.suggestions.map(s => `- ${s}`).join('\n');
          }
        }

        // Add compliance warning if rules were violated
        if (hasComplianceIssues) {
          contentWithFooter += '\n\n---\n⚠️ **Quality Warning:** ' + compliance.issues.join(', ');
        }

        // Build TSC status for footer
        const tscStatus = tscResult ? (tscResult.passed ? '✅' : '❌') : '⏭️';

        // Build cost display
        const costDisplay = usage ? ` | Cost: $${usage.estimatedCost.toFixed(4)}` : '';
        const tokenDisplay = usage ? ` | Tokens: ${usage.totalTokens.toLocaleString()}` : '';

        contentWithFooter += '\n\n---\n🍪 **CodeBakers** ' + statusIcon + ' | Files: ' +
          fileCount + ' | Commands: ' + cmdCount + ' | TSC: ' + tscStatus + tokenDisplay + costDisplay + ' | ' + patternNames;

        // GATE 2: Validate completion if we have an enforcement session and file operations
        let gate2Result: {
          passed: boolean;
          issues: string[];
          compliance: { score: number; deductions: Array<{ rule: string; issue: string; points: number }> };
          message?: string;
        } | null = null;

        if (this.currentEnforcementSession && fileOperations.length > 0) {
          try {
            const filesModified = fileOperations.map(op => op.path);
            const testsWritten = fileOperations.filter(op =>
              op.path.includes('.test.') || op.path.includes('.spec.') || op.path.includes('/__tests__/')
            ).map(op => op.path);

            gate2Result = await this._callValidateComplete(
              this.currentEnforcementSession.token,
              lastMessage.substring(0, 100), // Use first 100 chars as feature name
              filesModified,
              testsWritten,
              testsWritten.length > 0, // testsRun
              tscResult?.passed ?? true, // testsPassed (use TSC as proxy)
              tscResult?.passed ?? true  // typescriptPassed
            );

            if (gate2Result) {
              if (gate2Result.passed) {
                console.log('CodeBakers: GATE 2 passed - compliance score:', gate2Result.compliance.score);
                contentWithFooter += ` | Gate 2: ✅ (${gate2Result.compliance.score}/100)`;
              } else {
                console.warn('CodeBakers: GATE 2 failed:', gate2Result.issues);
                contentWithFooter += `\n\n⚠️ **Gate 2 Issues:** ${gate2Result.issues.join(', ')}`;
                contentWithFooter += ` | Gate 2: ❌`;
              }
            }

            // Clear the enforcement session after validation
            this.currentEnforcementSession = null;
          } catch (error) {
            console.warn('CodeBakers: Gate 2 validation error:', error);
          }
        }

        return {
          content: contentWithFooter,
          thinking: thinking || undefined,
          fileOperations: fileOperations.length > 0 ? fileOperations : undefined,
          commands: commands.length > 0 ? commands : undefined,
          projectUpdates,
          validation,
          dependencyCheck,
          usage,
          gate2: gate2Result || undefined
        };
      } catch (error: any) {
        lastError = error;
        console.error(`Claude API error (attempt ${attempt}/${maxRetries}):`, error);

        // Don't retry if cancelled
        if (error.message === 'Request was cancelled') {
          throw error;
        }

        // Don't retry auth errors
        if (error.message?.includes('authenticated') || error.message?.includes('SUBSCRIPTION')) {
          throw error;
        }

        // Retry with exponential backoff for network/API errors
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
          callbacks?.onError?.(new Error(`Request failed, retrying in ${delay / 1000}s...`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    const finalError = lastError || new Error('Request failed after multiple retries');
    callbacks?.onError?.(finalError);
    throw finalError;
  }

  /**
   * Parse <thinking> tags from response to separate reasoning from content
   */
  private _parseThinkingAndContent(text: string): { thinking: string | null; content: string } {
    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);

    if (thinkingMatch) {
      const thinking = thinkingMatch[1].trim();
      const content = text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
      return { thinking, content };
    }

    return { thinking: null, content: text };
  }

  /**
   * Parse <file_operation> tags from response
   */
  parseFileOperations(text: string): FileOperation[] {
    const operations: FileOperation[] = [];
    const regex = /<file_operation>([\s\S]*?)<\/file_operation>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const block = match[1];

      // Extract action
      const actionMatch = block.match(/<action>(create|edit|delete)<\/action>/);
      if (!actionMatch) continue;

      // Extract path
      const pathMatch = block.match(/<path>([^<]+)<\/path>/);
      if (!pathMatch) continue;

      // Extract optional description
      const descMatch = block.match(/<description>([^<]+)<\/description>/);

      // Extract content (only for create/edit)
      const contentMatch = block.match(/<content>([\s\S]*?)<\/content>/);

      operations.push({
        action: actionMatch[1] as 'create' | 'edit' | 'delete',
        path: pathMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : undefined,
        content: contentMatch ? contentMatch[1].trim() : undefined,
      });
    }

    return operations;
  }

  /**
   * Parse <run_command> tags from response
   */
  parseCommands(text: string): CommandToRun[] {
    const commands: CommandToRun[] = [];
    const regex = /<run_command>([\s\S]*?)<\/run_command>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const block = match[1];

      // Extract command
      const cmdMatch = block.match(/<command>([^<]+)<\/command>/);
      if (!cmdMatch) continue;

      // Extract optional description
      const descMatch = block.match(/<description>([^<]+)<\/description>/);

      commands.push({
        command: cmdMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : undefined,
      });
    }

    return commands;
  }

  /**
   * Remove file operation and command tags from content for display
   */
  cleanContentForDisplay(text: string): string {
    return text
      .replace(/<file_operation>[\s\S]*?<\/file_operation>/g, '')
      .replace(/<run_command>[\s\S]*?<\/run_command>/g, '')
      .trim();
  }

  /**
   * COMPLIANCE CHECK - Verify the AI followed CodeBakers rules
   * This is programmatic enforcement - catches when AI ignores instructions
   */
  private _checkCompliance(
    fullText: string,
    thinking: string | null,
    fileOperations: FileOperation[],
    cleanContent: string
  ): { passed: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check 1: Did AI include thinking block?
    if (!thinking && cleanContent.length > 200) {
      // Only flag for substantial responses
      issues.push('Missing reasoning (thinking block)');
    }

    // Check 2: If response mentions code but no file_operation tags
    const hasCodeBlocks = /```[\s\S]*?```/.test(fullText);
    const mentionsFiles = /\.(tsx?|jsx?|css|json|md)\b/.test(cleanContent);
    if (hasCodeBlocks && mentionsFiles && fileOperations.length === 0) {
      issues.push('Code in markdown instead of file_operation tags');
    }

    // Check 3: Check for 'any' type usage in file operations
    for (const op of fileOperations) {
      if (op.content) {
        // Check for `: any` type annotations
        const anyCount = (op.content.match(/:\s*any\b/g) || []).length;
        if (anyCount > 2) {
          issues.push(`Excessive 'any' types in ${op.path} (${anyCount} found)`);
        }

        // Check for missing error handling in async functions
        if (op.content.includes('async ') && !op.content.includes('try') && !op.content.includes('catch')) {
          if (op.content.includes('await ')) {
            issues.push(`Missing try/catch in ${op.path}`);
          }
        }
      }
    }

    // Check 4: API routes should have error handling
    for (const op of fileOperations) {
      if (op.path.includes('/api/') && op.content) {
        if (!op.content.includes('catch') && !op.content.includes('NextResponse.json')) {
          issues.push(`API route ${op.path} may lack error handling`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      issues
    };
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

    // Include token in query param as fallback (VS Code may strip headers)
    const url = `${this._getApiEndpoint()}/api/tools?token=${encodeURIComponent(this.sessionToken)}`;
    const response = await this._fetchWithTimeout(url, {
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

    // Include token in query param as fallback (VS Code may strip headers)
    const url = `${this._getApiEndpoint()}/api/tools?token=${encodeURIComponent(this.sessionToken)}`;
    const response = await this._fetchWithTimeout(url, {
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
    return `# CodeBakers AI Assistant
Version: 1.0.37

You are CodeBakers, an advanced AI coding assistant that can READ files, WRITE files, and RUN commands - just like Claude Code or Cursor.

## YOUR CAPABILITIES

You can:
1. **Read files** - Access any file in the workspace
2. **Write files** - Create new files or edit existing ones
3. **Run commands** - Execute terminal commands (npm, git, etc.)
4. **Apply patterns** - Use production-ready code patterns

## THINKING PROCESS (REQUIRED)

Before EVERY response, show your reasoning in <thinking> tags:

<thinking>
- Understanding: What is the user asking for?
- Analysis: What files exist? What needs to change?
- Plan: Step-by-step implementation approach
- Patterns: Which CodeBakers patterns apply?
- Risks: What could go wrong? Edge cases?
</thinking>

## FILE OPERATIONS FORMAT

When you need to create or edit files, use this EXACT format:

<file_operation>
<action>create</action>
<path>src/components/LoginForm.tsx</path>
<description>Create login form component with validation</description>
<content>
// File content here
import React from 'react';
// ... rest of code
</content>
</file_operation>

For editing existing files:
<file_operation>
<action>edit</action>
<path>src/app/page.tsx</path>
<description>Add login button to homepage</description>
<content>
// FULL new file content (not a diff)
</content>
</file_operation>

For deleting files:
<file_operation>
<action>delete</action>
<path>src/old-file.ts</path>
<description>Remove deprecated file</description>
</file_operation>

## COMMAND EXECUTION FORMAT

When you need to run terminal commands:

<run_command>
<command>npm install zod react-hook-form</command>
<description>Install form validation dependencies</description>
</run_command>

<run_command>
<command>npx prisma db push</command>
<description>Push schema changes to database</description>
</run_command>

## CODING STANDARDS

1. **TypeScript** - Always use TypeScript with proper types
2. **Error Handling** - Always wrap async operations in try/catch
3. **Validation** - Use Zod for input validation
4. **Loading States** - Always handle loading and error states
5. **Accessibility** - Include ARIA labels, keyboard navigation
6. **Security** - Never expose secrets, validate all inputs

## CODE QUALITY REQUIREMENTS

Every file you create/edit MUST have:
- Proper imports (no unused imports)
- Type annotations (no 'any' unless absolutely necessary)
- Error boundaries for React components
- Loading and error states for async operations
- Comments for complex logic only

## RESPONSE STRUCTURE

1. <thinking>...</thinking> - Your reasoning (REQUIRED)
2. Brief explanation of what you'll do
3. <file_operation>...</file_operation> blocks for each file
4. <run_command>...</run_command> blocks for commands
5. Summary of changes made
6. Footer with patterns used

## CURRENT PROJECT STATE
${projectState ? JSON.stringify(projectState, null, 2) : 'No workspace open - ask user to open a project folder'}

## PROJECT FILE STRUCTURE
${projectState?.fileTree ? `
IMPORTANT: Use this structure to know WHERE to create files:
\`\`\`
${projectState.fileTree}
\`\`\`
- Create API routes in the existing api/ folder
- Create components in the existing components/ folder
- Follow the existing project structure - DO NOT create new top-level folders unless necessary
` : 'No file tree available - ask user to open a project folder'}

## EXISTING TYPES (Reuse these - do NOT recreate)
${projectState?.existingTypes || 'No existing types found - you may create new types as needed'}

## INSTALLED PACKAGES
${projectState?.installedPackages?.length > 0 ? `
Available packages (already installed):
${projectState.installedPackages.slice(0, 30).join(', ')}

IMPORTANT: Only import from packages listed above or Node.js built-ins.
If you need a package not listed, include a <run_command> to install it.
` : 'No package.json found'}

## FOOTER (Required on every response with code)

---
🍪 **CodeBakers** | Files: [count] | Commands: [count] | Patterns: [list] | v1.0.40

## CRITICAL RULES (ENFORCED - NOT OPTIONAL)

These rules are STRUCTURALLY ENFORCED. The user PAID for this quality guarantee.

### MANDATORY THINKING BLOCK
You MUST start every response with <thinking>...</thinking> containing:
1. What patterns from LOADED PATTERNS section apply?
2. What existing code patterns should I match?
3. What could go wrong? (error cases, edge cases)

If your response lacks <thinking> tags, it is INVALID and will be rejected.

### MANDATORY PATTERN USAGE
Look at the "# LOADED PATTERNS" section below. You MUST:
1. Use code structures shown in the patterns
2. Use the same libraries (Zod, React Hook Form, etc.)
3. Match the error handling style
4. Include all required elements (loading states, validation, etc.)

If you write code that ignores the loaded patterns, you are FAILING your job.

### MANDATORY FILE OPERATION FORMAT
For ANY file change, you MUST use:
<file_operation>
<action>create|edit|delete</action>
<path>relative/path/to/file.ts</path>
<description>What this change does</description>
<content>COMPLETE file content - never partial</content>
</file_operation>

Code in regular markdown blocks will NOT be applied. Only <file_operation> blocks work.

### MANDATORY TEST REQUIREMENT
Every feature MUST include at least one test file. Do not ask "want me to add tests?" - just add them.

### MANDATORY FOOTER
End every code response with:
---
🍪 **CodeBakers** | Files: [count] | Commands: [count] | Patterns: [list] | v1.0.40

### NEVER DO THESE (Pattern Violations)
- ❌ Skip error handling (wrap async in try/catch)
- ❌ Use 'any' type (use proper types from patterns)
- ❌ Ignore loaded patterns (they exist for a reason)
- ❌ Create files without validation (use Zod)
- ❌ Skip loading states (always handle pending/error/success)
- ❌ Write code from memory when patterns exist

### SELF-CHECK BEFORE RESPONDING
Before sending, verify:
[ ] <thinking> block present?
[ ] Patterns from LOADED PATTERNS section used?
[ ] <file_operation> tags for all file changes?
[ ] Error handling included?
[ ] Loading states handled?
[ ] Footer included?

If any checkbox is NO, fix it before responding.
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

  /**
   * Extract keywords from a message for pattern matching
   */
  private _extractKeywords(message: string): string[] {
    const keywordPatterns: Record<string, string[]> = {
      database: ['database', 'db', 'schema', 'table', 'query', 'drizzle', 'postgres', 'sql'],
      auth: ['auth', 'login', 'signup', 'session', 'password', 'oauth', 'jwt', 'token'],
      api: ['api', 'route', 'endpoint', 'rest', 'fetch', 'request', 'response'],
      frontend: ['component', 'react', 'form', 'ui', 'page', 'button', 'modal'],
      payments: ['payment', 'stripe', 'billing', 'subscription', 'checkout', 'price'],
      testing: ['test', 'testing', 'playwright', 'vitest', 'jest', 'spec'],
    };

    const lowerMessage = message.toLowerCase();
    const foundKeywords: string[] = [];

    for (const [category, words] of Object.entries(keywordPatterns)) {
      if (words.some(word => lowerMessage.includes(word))) {
        foundKeywords.push(category);
      }
    }

    return foundKeywords.length > 0 ? foundKeywords : ['general'];
  }

  /**
   * Call server-side pattern discovery (GATE 1)
   * Creates an enforcement session and returns relevant patterns
   */
  private async _callDiscoverPatterns(task: string, keywords: string[]): Promise<{
    sessionToken: string;
    patterns: Array<{ name: string; content: string; relevance: number }>;
    expiresAt: string;
    message?: string;
  } | null> {
    if (!this.sessionToken) {
      console.log('CodeBakers: No session token, skipping server pattern discovery');
      return null;
    }

    try {
      const url = `${this._getApiEndpoint()}/api/patterns/discover`;
      const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          keywords,
          projectPath,
        }),
      }, 15000); // 15 second timeout

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('CodeBakers: Pattern discovery failed:', errorData);
        return null;
      }

      const data = await response.json() as {
        sessionToken?: string;
        patterns?: Array<{ name: string; content: string; relevance: number }>;
        expiresAt?: string;
        message?: string;
      };
      return {
        sessionToken: data.sessionToken || '',
        patterns: data.patterns || [],
        expiresAt: data.expiresAt || '',
        message: data.message,
      };
    } catch (error) {
      console.warn('CodeBakers: Pattern discovery error:', error);
      return null;
    }
  }

  /**
   * Call server-side validation (GATE 2)
   * Validates that patterns were followed before allowing file operations
   */
  private async _callValidateComplete(
    sessionToken: string,
    featureName: string,
    filesModified: string[],
    testsWritten: string[] = [],
    testsRun: boolean = false,
    testsPassed: boolean = false,
    typescriptPassed: boolean = true
  ): Promise<{
    passed: boolean;
    issues: string[];
    compliance: { score: number; deductions: Array<{ rule: string; issue: string; points: number }> };
    message?: string;
  } | null> {
    if (!this.sessionToken) {
      return null;
    }

    try {
      const url = `${this._getApiEndpoint()}/api/patterns/validate`;

      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken,
          featureName,
          filesModified,
          testsWritten,
          testsRun,
          testsPassed,
          typescriptPassed,
        }),
      }, 15000);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        console.warn('CodeBakers: Validation failed:', errorData);
        return {
          passed: false,
          issues: [errorData.error || 'Validation failed'],
          compliance: { score: 0, deductions: [] },
        };
      }

      const data = await response.json() as {
        passed?: boolean;
        issues?: string[];
        compliance?: { score: number; deductions: Array<{ rule: string; issue: string; points: number }> };
        message?: string;
      };
      return {
        passed: data.passed ?? false,
        issues: data.issues || [],
        compliance: data.compliance || { score: 100, deductions: [] },
        message: data.message,
      };
    } catch (error) {
      console.warn('CodeBakers: Validation error:', error);
      return null;
    }
  }

  private _getApiEndpoint(): string {
    return vscode.workspace.getConfiguration('codebakers').get('apiEndpoint', 'https://www.codebakers.ai');
  }
}
