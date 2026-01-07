import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ProjectState {
  // From .codebakers.json
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

  // Computed context
  recentFiles?: string[];
  packageDeps?: string[];
  hasTests?: boolean;
  openFile?: string;
  selectedText?: string;
  fileTree?: string; // Project directory structure
  existingTypes?: string; // Type inventory for reuse
  installedPackages?: string[]; // List of npm packages

  // Conversation memory
  keyDecisions?: string[];
  completedTasks?: string[];
  blockers?: string[];

  // AI Project Memory
  aiMemory?: AIMemory;
}

// AI Project Memory - persists across sessions
interface AIMemory {
  // Architectural decisions learned from conversations
  architecture: MemoryItem[];
  // User preferences and coding style
  preferences: MemoryItem[];
  // Important files and their purposes
  keyFiles: MemoryItem[];
  // Common patterns used in this project
  patterns: MemoryItem[];
  // Things to avoid (learned from errors/feedback)
  avoid: MemoryItem[];
  // Last updated timestamp
  lastUpdated: string;
}

interface MemoryItem {
  content: string;
  confidence: number; // 0-1, higher = more certain
  source: 'user' | 'inferred' | 'explicit'; // Where this came from
  timestamp: string;
}

interface ProjectUpdate {
  patterns?: string[];
  tasks?: string[];
  decisions?: Record<string, string>;
}

export class ProjectContext {
  private _cache: ProjectState | null = null;
  private _cacheTime: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor() {}

  /**
   * Get current project state for context injection
   * This is the "perfect recall" - we maintain state outside the conversation
   */
  async getProjectState(): Promise<ProjectState | null> {
    // Check cache
    if (this._cache && Date.now() - this._cacheTime < this.CACHE_TTL) {
      // Still add dynamic context (selected text, open file)
      return {
        ...this._cache,
        ...this._getDynamicContext()
      };
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;

    const rootPath = workspaceFolder.uri.fsPath;
    const state: ProjectState = {};

    // Read .codebakers.json if exists
    const codebakersPath = path.join(rootPath, '.codebakers.json');
    if (fs.existsSync(codebakersPath)) {
      try {
        const content = fs.readFileSync(codebakersPath, 'utf-8');
        const codebakersJson = JSON.parse(content);
        Object.assign(state, codebakersJson);
      } catch (error) {
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
      } catch (error) {
        console.error('Failed to read package.json:', error);
      }
    }

    // Check for test files
    state.hasTests = await this._hasTestFiles(rootPath);

    // Get recently modified files
    state.recentFiles = await this._getRecentFiles(rootPath);

    // Get file tree structure (for knowing where to create files)
    state.fileTree = await this._getFileTree(rootPath);

    // Get existing types for AI to reuse
    state.existingTypes = await this._scanExistingTypes(rootPath);

    // Store installed packages list
    state.installedPackages = state.packageDeps?.slice(0, 50);

    // Read devlog for recent context
    const devlogPath = path.join(rootPath, '.codebakers', 'DEVLOG.md');
    if (fs.existsSync(devlogPath)) {
      try {
        const content = fs.readFileSync(devlogPath, 'utf-8');
        // Extract recent decisions and tasks from devlog
        state.keyDecisions = this._extractFromDevlog(content, 'decisions');
        state.completedTasks = this._extractFromDevlog(content, 'tasks');
      } catch (error) {
        console.error('Failed to read devlog:', error);
      }
    }

    // Read blockers file
    const blockedPath = path.join(rootPath, '.codebakers', 'BLOCKED.md');
    if (fs.existsSync(blockedPath)) {
      try {
        const content = fs.readFileSync(blockedPath, 'utf-8');
        state.blockers = this._extractBlockers(content);
      } catch (error) {
        console.error('Failed to read blockers:', error);
      }
    }

    // Load AI Project Memory
    state.aiMemory = await this._loadAIMemory(rootPath);

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
  async applyUpdates(updates: ProjectUpdate): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const rootPath = workspaceFolder.uri.fsPath;
    const codebakersPath = path.join(rootPath, '.codebakers.json');

    // Read existing state
    let existing: any = {};
    if (fs.existsSync(codebakersPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(codebakersPath, 'utf-8'));
      } catch {
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
  invalidateCache(): void {
    this._cache = null;
  }

  /**
   * Get dynamic context (current editor state)
   */
  private _getDynamicContext(): Partial<ProjectState> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return {};

    const context: Partial<ProjectState> = {
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
  private _detectStack(deps: string[]): ProjectState['stack'] {
    const stack: ProjectState['stack'] = {};

    // Framework
    if (deps.includes('next')) stack.framework = 'nextjs';
    else if (deps.includes('react')) stack.framework = 'react';
    else if (deps.includes('vue')) stack.framework = 'vue';
    else if (deps.includes('svelte')) stack.framework = 'svelte';

    // Database/ORM
    if (deps.includes('drizzle-orm')) stack.database = 'drizzle';
    else if (deps.includes('prisma')) stack.database = 'prisma';
    else if (deps.includes('mongoose')) stack.database = 'mongodb';

    // Auth
    if (deps.includes('@supabase/supabase-js')) stack.auth = 'supabase';
    else if (deps.includes('next-auth')) stack.auth = 'next-auth';
    else if (deps.includes('@clerk/nextjs')) stack.auth = 'clerk';

    // UI
    if (deps.some(d => d.includes('@radix-ui'))) stack.ui = 'shadcn';
    else if (deps.includes('@chakra-ui/react')) stack.ui = 'chakra';
    else if (deps.includes('@mui/material')) stack.ui = 'mui';

    // Payments
    const payments: string[] = [];
    if (deps.includes('stripe')) payments.push('stripe');
    if (deps.includes('@paypal/react-paypal-js')) payments.push('paypal');
    if (payments.length > 0) stack.payments = payments;

    return stack;
  }

  /**
   * Check if project has test files
   */
  private async _hasTestFiles(rootPath: string): Promise<boolean> {
    const testPatterns = ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/tests/**'];

    for (const pattern of testPatterns) {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
      if (files.length > 0) return true;
    }

    return false;
  }

  /**
   * Get recently modified files
   */
  private async _getRecentFiles(rootPath: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx}',
      '**/node_modules/**',
      50
    );

    // Sort by modification time and take top 10
    const withStats = await Promise.all(
      files.map(async (f) => {
        try {
          const stat = await vscode.workspace.fs.stat(f);
          return { path: vscode.workspace.asRelativePath(f), mtime: stat.mtime };
        } catch {
          return null;
        }
      })
    );

    return withStats
      .filter((f): f is { path: string; mtime: number } => f !== null)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 10)
      .map(f => f.path);
  }

  /**
   * Get file tree structure for AI context
   * This helps the AI understand where files exist and where to create new ones
   */
  private async _getFileTree(rootPath: string, maxDepth: number = 4): Promise<string> {
    const IGNORE_DIRS = new Set([
      'node_modules', '.git', '.next', 'dist', 'build', '.vercel',
      '.turbo', 'coverage', '.cache', '.nuxt', '.output', '__pycache__'
    ]);

    const IMPORTANT_DIRS = new Set([
      'src', 'app', 'pages', 'components', 'lib', 'utils', 'hooks',
      'api', 'services', 'types', 'styles', 'public', 'tests', '__tests__'
    ]);

    const lines: string[] = [];

    const scan = (dir: string, prefix: string, depth: number): void => {
      if (depth > maxDepth) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        // Separate directories and files
        const dirs = entries.filter(e => e.isDirectory() && !IGNORE_DIRS.has(e.name) && !e.name.startsWith('.'));
        const files = entries.filter(e => e.isFile());

        // Sort: important dirs first, then alphabetically
        dirs.sort((a, b) => {
          const aImportant = IMPORTANT_DIRS.has(a.name);
          const bImportant = IMPORTANT_DIRS.has(b.name);
          if (aImportant && !bImportant) return -1;
          if (!aImportant && bImportant) return 1;
          return a.name.localeCompare(b.name);
        });

        // Show directories
        for (let i = 0; i < dirs.length; i++) {
          const entry = dirs[i];
          const isLast = i === dirs.length - 1 && files.length === 0;
          const connector = isLast ? '└── ' : '├── ';
          const childPrefix = isLast ? '    ' : '│   ';

          lines.push(`${prefix}${connector}${entry.name}/`);
          scan(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
        }

        // Show key files at depth 0-1, or all files at deeper levels (limited)
        const keyFiles = files.filter(f =>
          depth <= 1 ?
            ['package.json', 'tsconfig.json', '.env.example', 'next.config.js', 'next.config.mjs', 'drizzle.config.ts'].includes(f.name) ||
            f.name.endsWith('.ts') || f.name.endsWith('.tsx')
          : true
        );

        // Limit files shown at each level
        const maxFiles = depth === 0 ? 5 : (depth === 1 ? 10 : 15);
        const filesToShow = keyFiles.slice(0, maxFiles);
        const hiddenCount = keyFiles.length - filesToShow.length;

        for (let i = 0; i < filesToShow.length; i++) {
          const file = filesToShow[i];
          const isLast = i === filesToShow.length - 1 && hiddenCount === 0;
          const connector = isLast ? '└── ' : '├── ';
          lines.push(`${prefix}${connector}${file.name}`);
        }

        if (hiddenCount > 0) {
          lines.push(`${prefix}└── ... (${hiddenCount} more files)`);
        }

      } catch (error) {
        // Ignore permission errors
      }
    };

    lines.push(path.basename(rootPath) + '/');
    scan(rootPath, '', 0);

    return lines.join('\n');
  }

  /**
   * Scan project for existing types that AI can reuse
   * This prevents creating duplicate types
   */
  private async _scanExistingTypes(rootPath: string): Promise<string> {
    const types: { name: string; file: string; kind: string }[] = [];

    // Find TypeScript files in src/types, src/lib, etc
    const typeDirs = ['src/types', 'src/lib', 'types', 'lib'];

    for (const dir of typeDirs) {
      const dirPath = path.join(rootPath, dir);
      if (!fs.existsSync(dirPath)) continue;

      try {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

        for (const file of files.slice(0, 10)) { // Limit files per dir
          const filePath = path.join(dirPath, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.join(dir, file);

            // Extract interfaces
            const interfaceRegex = /export\s+interface\s+(\w+)/g;
            let match;
            while ((match = interfaceRegex.exec(content)) !== null) {
              types.push({ name: match[1], file: relativePath, kind: 'interface' });
            }

            // Extract type aliases
            const typeRegex = /export\s+type\s+(\w+)/g;
            while ((match = typeRegex.exec(content)) !== null) {
              types.push({ name: match[1], file: relativePath, kind: 'type' });
            }

            // Extract enums
            const enumRegex = /export\s+enum\s+(\w+)/g;
            while ((match = enumRegex.exec(content)) !== null) {
              types.push({ name: match[1], file: relativePath, kind: 'enum' });
            }
          } catch {
            // Skip files we can't read
          }
        }
      } catch {
        // Skip dirs we can't read
      }
    }

    if (types.length === 0) {
      return '';
    }

    // Format for AI context
    const lines = ['EXISTING TYPES (import these instead of creating new):'];
    const byFile = new Map<string, typeof types>();

    for (const t of types) {
      const arr = byFile.get(t.file) || [];
      arr.push(t);
      byFile.set(t.file, arr);
    }

    for (const [file, fileTypes] of byFile) {
      lines.push(`  ${file}:`);
      for (const t of fileTypes.slice(0, 5)) {
        lines.push(`    - ${t.kind} ${t.name}`);
      }
      if (fileTypes.length > 5) {
        lines.push(`    ... and ${fileTypes.length - 5} more`);
      }
    }

    return lines.slice(0, 30).join('\n'); // Limit output size
  }

  /**
   * Extract information from devlog
   */
  private _extractFromDevlog(content: string, type: 'decisions' | 'tasks'): string[] {
    const results: string[] = [];
    const lines = content.split('\n');

    // Look for the most recent entry's relevant section
    let inRecentEntry = false;
    let inSection = false;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        inRecentEntry = true;
      } else if (line.startsWith('---')) {
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
          } else if (line.startsWith('- ')) {
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
  private _extractBlockers(content: string): string[] {
    const blockers: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('**Blocking Issue:**')) {
        blockers.push(line.replace('**Blocking Issue:**', '').trim());
      }
    }

    return blockers;
  }

  // ==================== AI PROJECT MEMORY ====================

  /**
   * Load AI memory from .codebakers/memory.json
   */
  private async _loadAIMemory(rootPath: string): Promise<AIMemory | undefined> {
    const memoryPath = path.join(rootPath, '.codebakers', 'memory.json');

    if (!fs.existsSync(memoryPath)) {
      return undefined;
    }

    try {
      const content = fs.readFileSync(memoryPath, 'utf-8');
      return JSON.parse(content) as AIMemory;
    } catch (error) {
      console.error('Failed to load AI memory:', error);
      return undefined;
    }
  }

  /**
   * Save AI memory to .codebakers/memory.json
   */
  private async _saveAIMemory(rootPath: string, memory: AIMemory): Promise<void> {
    const codebakersDir = path.join(rootPath, '.codebakers');
    const memoryPath = path.join(codebakersDir, 'memory.json');

    // Ensure .codebakers directory exists
    if (!fs.existsSync(codebakersDir)) {
      fs.mkdirSync(codebakersDir, { recursive: true });
    }

    memory.lastUpdated = new Date().toISOString();
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
  }

  /**
   * Add a memory item to the AI memory
   */
  async addMemory(
    category: keyof Omit<AIMemory, 'lastUpdated'>,
    content: string,
    source: MemoryItem['source'] = 'inferred',
    confidence: number = 0.7
  ): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const rootPath = workspaceFolder.uri.fsPath;
    let memory = await this._loadAIMemory(rootPath);

    // Initialize memory if it doesn't exist
    if (!memory) {
      memory = {
        architecture: [],
        preferences: [],
        keyFiles: [],
        patterns: [],
        avoid: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Check for duplicates (similar content)
    const existing = memory[category].find(m =>
      this._similarContent(m.content, content)
    );

    if (existing) {
      // Update confidence if higher
      if (confidence > existing.confidence) {
        existing.confidence = confidence;
        existing.timestamp = new Date().toISOString();
      }
      return;
    }

    // Add new memory item
    const newItem: MemoryItem = {
      content,
      confidence,
      source,
      timestamp: new Date().toISOString()
    };

    memory[category].push(newItem);

    // Keep only top 20 items per category (highest confidence)
    memory[category] = memory[category]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);

    await this._saveAIMemory(rootPath, memory);
    this._cache = null; // Invalidate cache
  }

  /**
   * Check if two strings are similar (simple implementation)
   */
  private _similarContent(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const na = normalize(a);
    const nb = normalize(b);

    // Check if one contains the other
    if (na.includes(nb) || nb.includes(na)) return true;

    // Simple similarity check
    const words1 = new Set(a.toLowerCase().split(/\s+/));
    const words2 = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size > 0.7;
  }

  /**
   * Format AI memory for inclusion in system prompt
   */
  formatMemoryForPrompt(memory: AIMemory): string {
    const sections: string[] = ['## 🧠 AI Project Memory (learned from previous sessions)'];

    const formatCategory = (items: MemoryItem[], title: string, emoji: string): void => {
      const highConfidence = items.filter(m => m.confidence >= 0.5);
      if (highConfidence.length === 0) return;

      sections.push(`\n### ${emoji} ${title}`);
      for (const item of highConfidence.slice(0, 10)) {
        const conf = item.confidence >= 0.9 ? '✓' : item.confidence >= 0.7 ? '~' : '?';
        sections.push(`- [${conf}] ${item.content}`);
      }
    };

    formatCategory(memory.architecture, 'Architecture Decisions', '🏗️');
    formatCategory(memory.preferences, 'User Preferences', '⚙️');
    formatCategory(memory.keyFiles, 'Key Files', '📁');
    formatCategory(memory.patterns, 'Common Patterns', '🔄');
    formatCategory(memory.avoid, 'Things to Avoid', '⛔');

    if (sections.length === 1) {
      return ''; // No memories to show
    }

    return sections.join('\n');
  }

  /**
   * Learn from AI response - extract key insights to remember
   */
  async learnFromResponse(response: string, userMessage: string): Promise<void> {
    // Look for explicit memory markers in the response
    const memoryPatterns = [
      { pattern: /REMEMBER:\s*(.+?)(?:\n|$)/gi, category: 'architecture' as const },
      { pattern: /USER PREFERS:\s*(.+?)(?:\n|$)/gi, category: 'preferences' as const },
      { pattern: /KEY FILE:\s*(.+?)(?:\n|$)/gi, category: 'keyFiles' as const },
      { pattern: /PATTERN:\s*(.+?)(?:\n|$)/gi, category: 'patterns' as const },
      { pattern: /AVOID:\s*(.+?)(?:\n|$)/gi, category: 'avoid' as const },
    ];

    for (const { pattern, category } of memoryPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        await this.addMemory(category, match[1].trim(), 'explicit', 0.95);
      }
    }

    // Auto-learn from certain patterns
    // If user corrects something, remember to avoid it
    if (userMessage.toLowerCase().includes("don't") ||
        userMessage.toLowerCase().includes("never") ||
        userMessage.toLowerCase().includes("stop")) {
      const avoidMatch = userMessage.match(/(?:don't|never|stop)\s+(.+?)(?:\.|$)/i);
      if (avoidMatch) {
        await this.addMemory('avoid', avoidMatch[1].trim(), 'user', 0.9);
      }
    }

    // If user says "always" or "prefer", remember it
    if (userMessage.toLowerCase().includes("always") ||
        userMessage.toLowerCase().includes("prefer")) {
      const prefMatch = userMessage.match(/(?:always|prefer)\s+(.+?)(?:\.|$)/i);
      if (prefMatch) {
        await this.addMemory('preferences', prefMatch[1].trim(), 'user', 0.9);
      }
    }
  }

  /**
   * Clear all AI memories
   */
  async clearMemory(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const memoryPath = path.join(workspaceFolder.uri.fsPath, '.codebakers', 'memory.json');
    if (fs.existsSync(memoryPath)) {
      fs.unlinkSync(memoryPath);
    }
    this._cache = null;
  }
}
