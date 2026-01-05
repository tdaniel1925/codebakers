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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectContext = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ProjectContext {
    constructor() {
        this._cache = null;
        this._cacheTime = 0;
        this.CACHE_TTL = 30000; // 30 seconds
    }
    /**
     * Get current project state for context injection
     * This is the "perfect recall" - we maintain state outside the conversation
     */
    async getProjectState() {
        // Check cache
        if (this._cache && Date.now() - this._cacheTime < this.CACHE_TTL) {
            // Still add dynamic context (selected text, open file)
            return {
                ...this._cache,
                ...this._getDynamicContext()
            };
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return null;
        const rootPath = workspaceFolder.uri.fsPath;
        const state = {};
        // Read .codebakers.json if exists
        const codebakersPath = path.join(rootPath, '.codebakers.json');
        if (fs.existsSync(codebakersPath)) {
            try {
                const content = fs.readFileSync(codebakersPath, 'utf-8');
                const codebakersJson = JSON.parse(content);
                Object.assign(state, codebakersJson);
            }
            catch (error) {
                console.error('Failed to read .codebakers.json:', error);
            }
        }
        // Read package.json for dependencies
        const packagePath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packagePath)) {
            try {
                const content = fs.readFileSync(packagePath, 'utf-8');
                const pkg = JSON.parse(content);
                state.packageDeps = [
                    ...Object.keys(pkg.dependencies || {}),
                    ...Object.keys(pkg.devDependencies || {})
                ];
                // Detect stack from dependencies
                if (!state.stack) {
                    state.stack = this._detectStack(state.packageDeps);
                }
            }
            catch (error) {
                console.error('Failed to read package.json:', error);
            }
        }
        // Check for test files
        state.hasTests = await this._hasTestFiles(rootPath);
        // Get recently modified files
        state.recentFiles = await this._getRecentFiles(rootPath);
        // Read devlog for recent context
        const devlogPath = path.join(rootPath, '.codebakers', 'DEVLOG.md');
        if (fs.existsSync(devlogPath)) {
            try {
                const content = fs.readFileSync(devlogPath, 'utf-8');
                // Extract recent decisions and tasks from devlog
                state.keyDecisions = this._extractFromDevlog(content, 'decisions');
                state.completedTasks = this._extractFromDevlog(content, 'tasks');
            }
            catch (error) {
                console.error('Failed to read devlog:', error);
            }
        }
        // Read blockers file
        const blockedPath = path.join(rootPath, '.codebakers', 'BLOCKED.md');
        if (fs.existsSync(blockedPath)) {
            try {
                const content = fs.readFileSync(blockedPath, 'utf-8');
                state.blockers = this._extractBlockers(content);
            }
            catch (error) {
                console.error('Failed to read blockers:', error);
            }
        }
        // Cache the result
        this._cache = state;
        this._cacheTime = Date.now();
        // Add dynamic context
        return {
            ...state,
            ...this._getDynamicContext()
        };
    }
    /**
     * Apply updates to project state (called after Claude responses)
     */
    async applyUpdates(updates) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const rootPath = workspaceFolder.uri.fsPath;
        const codebakersPath = path.join(rootPath, '.codebakers.json');
        // Read existing state
        let existing = {};
        if (fs.existsSync(codebakersPath)) {
            try {
                existing = JSON.parse(fs.readFileSync(codebakersPath, 'utf-8'));
            }
            catch {
                existing = {};
            }
        }
        // Apply updates
        if (updates.decisions) {
            existing.decisions = {
                ...existing.decisions,
                ...updates.decisions
            };
        }
        if (updates.tasks) {
            existing.currentWork = existing.currentWork || {};
            existing.currentWork.pendingTasks = updates.tasks;
            existing.currentWork.lastUpdated = new Date().toISOString();
        }
        if (updates.patterns) {
            existing.analytics = existing.analytics || {};
            existing.analytics.modulesUsed = existing.analytics.modulesUsed || {};
            updates.patterns.forEach(p => {
                existing.analytics.modulesUsed[p] = (existing.analytics.modulesUsed[p] || 0) + 1;
            });
        }
        // Write back
        fs.writeFileSync(codebakersPath, JSON.stringify(existing, null, 2));
        // Invalidate cache
        this._cache = null;
    }
    /**
     * Invalidate cache when files change
     */
    invalidateCache() {
        this._cache = null;
    }
    /**
     * Get dynamic context (current editor state)
     */
    _getDynamicContext() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return {};
        const context = {
            openFile: vscode.workspace.asRelativePath(editor.document.uri)
        };
        const selection = editor.selection;
        if (!selection.isEmpty) {
            context.selectedText = editor.document.getText(selection);
        }
        return context;
    }
    /**
     * Detect tech stack from dependencies
     */
    _detectStack(deps) {
        const stack = {};
        // Framework
        if (deps.includes('next'))
            stack.framework = 'nextjs';
        else if (deps.includes('react'))
            stack.framework = 'react';
        else if (deps.includes('vue'))
            stack.framework = 'vue';
        else if (deps.includes('svelte'))
            stack.framework = 'svelte';
        // Database/ORM
        if (deps.includes('drizzle-orm'))
            stack.database = 'drizzle';
        else if (deps.includes('prisma'))
            stack.database = 'prisma';
        else if (deps.includes('mongoose'))
            stack.database = 'mongodb';
        // Auth
        if (deps.includes('@supabase/supabase-js'))
            stack.auth = 'supabase';
        else if (deps.includes('next-auth'))
            stack.auth = 'next-auth';
        else if (deps.includes('@clerk/nextjs'))
            stack.auth = 'clerk';
        // UI
        if (deps.some(d => d.includes('@radix-ui')))
            stack.ui = 'shadcn';
        else if (deps.includes('@chakra-ui/react'))
            stack.ui = 'chakra';
        else if (deps.includes('@mui/material'))
            stack.ui = 'mui';
        // Payments
        const payments = [];
        if (deps.includes('stripe'))
            payments.push('stripe');
        if (deps.includes('@paypal/react-paypal-js'))
            payments.push('paypal');
        if (payments.length > 0)
            stack.payments = payments;
        return stack;
    }
    /**
     * Check if project has test files
     */
    async _hasTestFiles(rootPath) {
        const testPatterns = ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/tests/**'];
        for (const pattern of testPatterns) {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
            if (files.length > 0)
                return true;
        }
        return false;
    }
    /**
     * Get recently modified files
     */
    async _getRecentFiles(rootPath) {
        const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**', 50);
        // Sort by modification time and take top 10
        const withStats = await Promise.all(files.map(async (f) => {
            try {
                const stat = await vscode.workspace.fs.stat(f);
                return { path: vscode.workspace.asRelativePath(f), mtime: stat.mtime };
            }
            catch {
                return null;
            }
        }));
        return withStats
            .filter((f) => f !== null)
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 10)
            .map(f => f.path);
    }
    /**
     * Extract information from devlog
     */
    _extractFromDevlog(content, type) {
        const results = [];
        const lines = content.split('\n');
        // Look for the most recent entry's relevant section
        let inRecentEntry = false;
        let inSection = false;
        for (const line of lines) {
            if (line.startsWith('## ')) {
                inRecentEntry = true;
            }
            else if (line.startsWith('---')) {
                break; // Only process most recent entry
            }
            if (inRecentEntry) {
                if (type === 'decisions' && line.toLowerCase().includes('decision')) {
                    inSection = true;
                    continue;
                }
                if (type === 'tasks' && line.toLowerCase().includes('what was done')) {
                    inSection = true;
                    continue;
                }
                if (inSection) {
                    if (line.startsWith('###') || line.startsWith('## ')) {
                        inSection = false;
                    }
                    else if (line.startsWith('- ')) {
                        results.push(line.substring(2).trim());
                    }
                }
            }
        }
        return results.slice(0, 5); // Limit to 5 items
    }
    /**
     * Extract blockers from BLOCKED.md
     */
    _extractBlockers(content) {
        const blockers = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('**Blocking Issue:**')) {
                blockers.push(line.replace('**Blocking Issue:**', '').trim());
            }
        }
        return blockers;
    }
}
exports.ProjectContext = ProjectContext;
//# sourceMappingURL=ProjectContext.js.map