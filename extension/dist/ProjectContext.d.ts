interface ProjectState {
    version?: string;
    projectType?: 'new' | 'existing';
    stack?: {
        framework?: string;
        database?: string;
        auth?: string;
        ui?: string;
        payments?: string[];
    };
    decisions?: Record<string, string>;
    currentWork?: {
        lastUpdated?: string;
        activeFeature?: string;
        status?: string;
        summary?: string;
        pendingTasks?: string[];
    };
    recentFiles?: string[];
    packageDeps?: string[];
    hasTests?: boolean;
    openFile?: string;
    selectedText?: string;
    keyDecisions?: string[];
    completedTasks?: string[];
    blockers?: string[];
}
interface ProjectUpdate {
    patterns?: string[];
    tasks?: string[];
    decisions?: Record<string, string>;
}
export declare class ProjectContext {
    private _cache;
    private _cacheTime;
    private readonly CACHE_TTL;
    constructor();
    /**
     * Get current project state for context injection
     * This is the "perfect recall" - we maintain state outside the conversation
     */
    getProjectState(): Promise<ProjectState | null>;
    /**
     * Apply updates to project state (called after Claude responses)
     */
    applyUpdates(updates: ProjectUpdate): Promise<void>;
    /**
     * Invalidate cache when files change
     */
    invalidateCache(): void;
    /**
     * Get dynamic context (current editor state)
     */
    private _getDynamicContext;
    /**
     * Detect tech stack from dependencies
     */
    private _detectStack;
    /**
     * Check if project has test files
     */
    private _hasTestFiles;
    /**
     * Get recently modified files
     */
    private _getRecentFiles;
    /**
     * Extract information from devlog
     */
    private _extractFromDevlog;
    /**
     * Extract blockers from BLOCKED.md
     */
    private _extractBlockers;
}
export {};
//# sourceMappingURL=ProjectContext.d.ts.map