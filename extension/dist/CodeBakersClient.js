"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeBakersClient = void 0;
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class CodeBakersClient {
    constructor(context) {
        this.context = context;
        this.anthropic = null;
        this.sessionToken = null;
        this.patterns = new Map();
        this.DEFAULT_TIMEOUT = 10000; // 10 seconds
        this.currentPlan = 'trial';
        this.isUnlimited = false;
        this.trialInfo = null;
        // Load cached session token
        this.sessionToken = context.globalState.get('codebakers.sessionToken') || null;
    }
    /**
     * Fetch with timeout to prevent hanging
     */
    async _fetchWithTimeout(url, options = {}, timeout = this.DEFAULT_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Check if user has a valid session token (doesn't validate with server)
     */
    hasSessionToken() {
        return !!this.sessionToken;
    }
    /**
     * Handle OAuth callback from VS Code URI handler
     * Called when vscode://codebakers.codebakers/callback?token=xxx is received
     */
    async handleOAuthCallback(encodedToken) {
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
            let decoded;
            try {
                decoded = Buffer.from(tokenToDecode, 'base64url').toString('utf-8');
            }
            catch {
                // Try standard base64 as fallback
                const base64 = tokenToDecode.replace(/-/g, '+').replace(/_/g, '/');
                decoded = Buffer.from(base64, 'base64').toString('utf-8');
            }
            console.log('handleOAuthCallback: decoded preview:', decoded?.substring(0, 100));
            const tokenPayload = JSON.parse(decoded);
            // Store session token (the full encoded payload, as the API expects it)
            this.sessionToken = encodedToken;
            await this.context.globalState.update('codebakers.sessionToken', encodedToken);
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
            vscode.window.showInformationMessage(`Welcome to CodeBakers, @${tokenPayload.githubUsername}! ${tokenPayload.trial ? `Trial: ${tokenPayload.trial.daysRemaining} days remaining` : ''}`);
            return true;
        }
        catch (e) {
            console.error('Failed to handle OAuth callback:', e);
            console.error('Token was:', encodedToken?.substring(0, 100));
            vscode.window.showErrorMessage(`Login failed: ${e instanceof Error ? e.message : 'Invalid token'}`);
            return false;
        }
    }
    async checkAuth() {
        if (!this.sessionToken)
            return false;
        try {
            const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            }, 5000); // 5 second timeout for auth check
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async login() {
        // Open browser to CodeBakers login
        // The callback will be handled by the global URI handler in extension.ts
        const callbackUri = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://codebakers.codebakers/callback`));
        const loginUrl = `${this._getApiEndpoint()}/vscode-login?callback=${encodeURIComponent(callbackUri.toString())}`;
        vscode.env.openExternal(vscode.Uri.parse(loginUrl));
        // Return true to indicate login was initiated
        // The actual login completion is handled by handleOAuthCallback
        return true;
    }
    async _initializeAnthropic() {
        // Get API key from our server (user's CodeBakers subscription includes Claude access)
        try {
            const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/claude/key`, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });
            const data = await response.json();
            console.log('Claude key response:', response.status, JSON.stringify(data));
            // Handle subscription required error
            if (response.status === 402) {
                const selection = await vscode.window.showWarningMessage(data.message || 'Subscribe to CodeBakers Pro ($99/month) for unlimited access', 'Subscribe Now', 'Start Free Trial');
                if (selection === 'Subscribe Now') {
                    vscode.env.openExternal(vscode.Uri.parse(data.upgradeUrl || 'https://www.codebakers.ai/dashboard/billing'));
                }
                else if (selection === 'Start Free Trial') {
                    vscode.env.openExternal(vscode.Uri.parse(data.trialUrl || 'https://www.codebakers.ai/dashboard/billing'));
                }
                throw new Error('SUBSCRIPTION_REQUIRED');
            }
            if (!response.ok) {
                throw new Error(`API error ${response.status}: ${data.error || data.message || 'Unknown error'}`);
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
                vscode.window.showWarningMessage(`Your CodeBakers trial expires in ${trial.daysRemaining} day${trial.daysRemaining === 1 ? '' : 's'}. Subscribe to keep using the extension.`, 'Subscribe Now').then(selection => {
                    if (selection === 'Subscribe Now') {
                        vscode.env.openExternal(vscode.Uri.parse('https://www.codebakers.ai/dashboard/billing'));
                    }
                });
            }
            this.anthropic = new sdk_1.default({ apiKey });
            // Also fetch patterns
            await this._loadPatterns();
        }
        catch (error) {
            console.error('Failed to initialize Anthropic client:', error);
            throw error;
        }
    }
    /**
     * Get current plan info for display
     */
    getPlanInfo() {
        return {
            plan: this.currentPlan,
            unlimited: this.isUnlimited,
            trial: this.trialInfo,
        };
    }
    async _loadPatterns() {
        try {
            const response = await this._fetchWithTimeout(`${this._getApiEndpoint()}/api/patterns/list`, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            }, 15000); // 15 seconds for pattern loading
            if (response.ok) {
                const data = await response.json();
                if (data.patterns) {
                    data.patterns.forEach((p) => this.patterns.set(p.name, p));
                }
            }
        }
        catch (error) {
            console.error('Failed to load patterns:', error);
        }
    }
    async chat(messages, projectState) {
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
                    role: m.role,
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
        }
        catch (error) {
            console.error('Claude API error:', error);
            throw error;
        }
    }
    async summarize(text) {
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
    async getAvailablePatterns() {
        return Array.from(this.patterns.values());
    }
    // ==========================================
    // TOOL EXECUTION (All MCP tools available)
    // ==========================================
    /**
     * Execute any CodeBakers tool
     */
    async executeTool(toolName, args = {}) {
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
            const errorData = await response.json();
            throw new Error(errorData.message || `Tool execution failed: ${toolName}`);
        }
        return response.json();
    }
    /**
     * List all available tools
     */
    async listTools() {
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
        const data = await response.json();
        return data.data?.tools || [];
    }
    // Convenience methods for common tools
    async discoverPatterns(task, keywords = []) {
        return this.executeTool('discover_patterns', { task, keywords });
    }
    async validateComplete(feature, files) {
        return this.executeTool('validate_complete', { feature, files });
    }
    async guardianAnalyze(files) {
        return this.executeTool('guardian_analyze', { files });
    }
    async guardianHeal(issues) {
        return this.executeTool('guardian_heal', { issues });
    }
    async guardianVerify() {
        return this.executeTool('guardian_verify', {});
    }
    async guardianStatus() {
        return this.executeTool('guardian_status', {});
    }
    async rippleCheck(entityName, changeType) {
        return this.executeTool('ripple_check', { entityName, changeType });
    }
    async runAudit() {
        return this.executeTool('run_audit', {});
    }
    async runTests() {
        return this.executeTool('run_tests', {});
    }
    async detectIntent(message) {
        return this.executeTool('detect_intent', { message });
    }
    _buildSystemPrompt(projectState) {
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
    async _detectRelevantPatterns(messages) {
        const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
        const relevant = [];
        // Keyword-based pattern detection
        const keywordMap = {
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
            relevant.push(this.patterns.get('00-core'));
        }
        // Add relevant patterns based on keywords
        for (const [pattern, keywords] of Object.entries(keywordMap)) {
            if (pattern === '00-core')
                continue;
            if (keywords.some(kw => lastMessage.includes(kw))) {
                const p = this.patterns.get(pattern);
                if (p)
                    relevant.push(p);
            }
        }
        return relevant;
    }
    _extractProjectUpdates(content) {
        // Extract any structured updates from the response
        // This is a simple implementation - could be enhanced with XML tags in prompt
        const updates = {};
        // Look for patterns like "Added pattern: X"
        const patternMatches = content.match(/(?:using|loaded|applied) pattern[s]?: ([^\n]+)/gi);
        if (patternMatches) {
            updates.patterns = patternMatches.flatMap(m => m.split(':')[1]?.split(',').map(s => s.trim()) || []);
        }
        return Object.keys(updates).length > 0 ? updates : undefined;
    }
    _getApiEndpoint() {
        return vscode.workspace.getConfiguration('codebakers').get('apiEndpoint', 'https://www.codebakers.ai');
    }
}
exports.CodeBakersClient = CodeBakersClient;
//# sourceMappingURL=CodeBakersClient.js.map