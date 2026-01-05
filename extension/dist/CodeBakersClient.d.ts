import * as vscode from 'vscode';
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
export declare class CodeBakersClient {
    private readonly context;
    private anthropic;
    private sessionToken;
    private patterns;
    private readonly DEFAULT_TIMEOUT;
    constructor(context: vscode.ExtensionContext);
    /**
     * Fetch with timeout to prevent hanging
     */
    private _fetchWithTimeout;
    /**
     * Check if user has a valid session token (doesn't validate with server)
     */
    hasSessionToken(): boolean;
    checkAuth(): Promise<boolean>;
    login(): Promise<boolean>;
    private currentPlan;
    private isUnlimited;
    private trialInfo;
    private _initializeAnthropic;
    /**
     * Get current plan info for display
     */
    getPlanInfo(): {
        plan: string;
        unlimited: boolean;
        trial: {
            endsAt: string;
            daysRemaining: number;
        } | null;
    };
    private _loadPatterns;
    chat(messages: any[], projectState: any): Promise<ChatResponse>;
    summarize(text: string): Promise<string>;
    getAvailablePatterns(): Promise<Pattern[]>;
    /**
     * Execute any CodeBakers tool
     */
    executeTool(toolName: string, args?: Record<string, any>): Promise<any>;
    /**
     * List all available tools
     */
    listTools(): Promise<Array<{
        name: string;
        category: string;
    }>>;
    discoverPatterns(task: string, keywords?: string[]): Promise<any>;
    validateComplete(feature: string, files: string[]): Promise<any>;
    guardianAnalyze(files: string[]): Promise<any>;
    guardianHeal(issues: any[]): Promise<any>;
    guardianVerify(): Promise<any>;
    guardianStatus(): Promise<any>;
    rippleCheck(entityName: string, changeType?: string): Promise<any>;
    runAudit(): Promise<any>;
    runTests(): Promise<any>;
    detectIntent(message: string): Promise<any>;
    private _buildSystemPrompt;
    private _detectRelevantPatterns;
    private _extractProjectUpdates;
    private _getApiEndpoint;
}
export {};
//# sourceMappingURL=CodeBakersClient.d.ts.map