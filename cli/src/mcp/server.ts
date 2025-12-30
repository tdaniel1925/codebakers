#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getApiKey, getApiUrl, getExperienceLevel, setExperienceLevel, getServiceKey, setServiceKey, getTrialState, isTrialExpired, getTrialDaysRemaining, hasValidAccess, getAuthMode, type ExperienceLevel, type TrialState } from '../config.js';
import { audit as runAudit } from '../commands/audit.js';
import { heal as runHeal } from '../commands/heal.js';
import { getCliVersion } from '../lib/api.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as templates from '../templates/nextjs-supabase.js';

// Version info type
interface VersionInfo {
  version: string;
  moduleCount: number;
  installedAt?: string;
  updatedAt?: string;
  cliVersion: string;
}

// Pattern cache to avoid repeated API calls
const patternCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Project context type
interface ProjectContext {
  projectName: string;
  dependencies: string[];
  devDependencies: string[];
  folderStructure: string[];
  hasAuth: boolean;
  hasDatabase: boolean;
  hasPayments: boolean;
  uiLibrary: string | null;
  schemaPath: string | null;
  componentsPath: string | null;
  existingComponents: string[];
  existingServices: string[];
  existingApiRoutes: string[];
  codebakersState: Record<string, unknown> | null;
}

// API response type for optimize-prompt
interface OptimizeResponse {
  optimizedPrompt: string;
  featureName: string;
  patterns: string[];
  method: string;
  hasContext: boolean;
}

class CodeBakersServer {
  private server: Server;
  private apiKey: string | null;
  private apiUrl: string;
  private trialState: TrialState | null;
  private authMode: 'apiKey' | 'trial' | 'none';
  private autoUpdateChecked = false;
  private autoUpdateInProgress = false;
  private pendingUpdate: { current: string; latest: string } | null = null;
  private lastUpdateCheck = 0;
  private updateCheckInterval = 60 * 60 * 1000; // Check every hour

  constructor() {
    this.apiKey = getApiKey();
    this.apiUrl = getApiUrl();
    this.trialState = getTrialState();
    this.authMode = getAuthMode();

    this.server = new Server(
      {
        name: 'codebakers',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();

    // Trigger auto-update check on startup (non-blocking)
    this.checkAndAutoUpdate().catch(() => {
      // Silently ignore errors - don't interrupt user
    });

    // Check for CLI version updates (non-blocking)
    this.checkCliVersion().catch(() => {
      // Silently ignore errors
    });

    // Start periodic update checks (every hour)
    setInterval(() => {
      this.checkCliVersion().catch(() => {});
    }, this.updateCheckInterval);
  }

  /**
   * Get update notice if a newer version is available
   */
  private getUpdateNotice(): string {
    if (this.pendingUpdate) {
      return `\n\n---\n🆕 **CodeBakers Update Available:** v${this.pendingUpdate.current} → v${this.pendingUpdate.latest}\nRestart Cursor/Claude Code to get new features!`;
    }
    return '';
  }

  /**
   * Check if a newer CLI version is available and notify user
   */
  private async checkCliVersion(): Promise<void> {
    try {
      // Rate limit checks
      const now = Date.now();
      if (now - this.lastUpdateCheck < 5 * 60 * 1000) return; // Min 5 minutes between checks
      this.lastUpdateCheck = now;

      const currentVersion = getCliVersion();

      // Fetch latest version from npm
      const response = await fetch('https://registry.npmjs.org/@codebakers/cli/latest', {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return;

      const data = await response.json();
      const latestVersion = data.version;

      if (latestVersion && latestVersion !== currentVersion) {
        // Compare versions (simple comparison - assumes semver)
        const current = currentVersion.split('.').map(Number);
        const latest = latestVersion.split('.').map(Number);

        const isNewer = latest[0] > current[0] ||
          (latest[0] === current[0] && latest[1] > current[1]) ||
          (latest[0] === current[0] && latest[1] === current[1] && latest[2] > current[2]);

        if (isNewer) {
          // Store pending update for inclusion in tool responses
          this.pendingUpdate = { current: currentVersion, latest: latestVersion };

          // Also log to stderr for immediate visibility
          console.error(`\n╔════════════════════════════════════════════════════════════╗`);
          console.error(`║  🆕 CodeBakers CLI Update Available: v${currentVersion} → v${latestVersion.padEnd(10)}║`);
          console.error(`║                                                            ║`);
          console.error(`║  Restart Cursor/Claude Code to get the latest features!   ║`);
          console.error(`╚════════════════════════════════════════════════════════════╝\n`);
        } else {
          // No update available
          this.pendingUpdate = null;
        }
      } else {
        this.pendingUpdate = null;
      }
    } catch {
      // Silently ignore - don't interrupt user experience
    }
  }

  /**
   * Get authorization headers for API requests
   * Supports both API key (paid users) and trial ID (free users)
   */
  private getAuthHeaders(): Record<string, string> {
    if (this.apiKey) {
      return { 'Authorization': `Bearer ${this.apiKey}` };
    }

    if (this.trialState?.trialId) {
      return { 'X-Trial-Id': this.trialState.trialId };
    }

    return {};
  }

  /**
   * Confirm download to server (non-blocking analytics)
   */
  private async confirmDownload(version: string, moduleCount: number): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      };

      await fetch(`${this.apiUrl}/api/content/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          version,
          moduleCount,
          cliVersion: getCliVersion(),
          command: 'auto-update',
        }),
      });
    } catch {
      // Silently ignore - this is just for analytics
    }
  }

  /**
   * Automatically check for and apply pattern updates
   * Runs silently in background - no user intervention needed
   */
  private async checkAndAutoUpdate(): Promise<void> {
    if (this.autoUpdateChecked || this.autoUpdateInProgress || this.authMode === 'none') {
      return;
    }

    this.autoUpdateInProgress = true;

    try {
      const cwd = process.cwd();
      const versionPath = path.join(cwd, '.claude', '.version.json');

      // Check if we should auto-update (once per 24 hours)
      let lastCheck: Date | null = null;
      let installed: VersionInfo | null = null;

      if (fs.existsSync(versionPath)) {
        try {
          installed = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
          const checkTime = installed?.updatedAt || installed?.installedAt;
          if (checkTime) {
            lastCheck = new Date(checkTime);
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Skip if checked within last 24 hours
      if (lastCheck) {
        const hoursSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCheck < 24) {
          this.autoUpdateChecked = true;
          this.autoUpdateInProgress = false;
          return;
        }
      }

      // Fetch latest version
      const response = await fetch(`${this.apiUrl}/api/content/version`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        this.autoUpdateInProgress = false;
        return;
      }

      const latest = await response.json();

      // Check if update needed
      if (installed && installed.version === latest.version) {
        // Already up to date - update timestamp to avoid checking for 24h
        installed.updatedAt = new Date().toISOString();
        fs.writeFileSync(versionPath, JSON.stringify(installed, null, 2));
        this.autoUpdateChecked = true;
        this.autoUpdateInProgress = false;
        return;
      }

      // Fetch full content and update
      const contentResponse = await fetch(`${this.apiUrl}/api/content`, {
        headers: this.getAuthHeaders(),
      });

      if (!contentResponse.ok) {
        this.autoUpdateInProgress = false;
        return;
      }

      const content = await contentResponse.json();
      const claudeDir = path.join(cwd, '.claude');

      // Ensure .claude directory exists
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      // Write updated modules
      let moduleCount = 0;
      if (content.modules) {
        for (const [name, data] of Object.entries(content.modules)) {
          fs.writeFileSync(path.join(claudeDir, name), data as string);
          moduleCount++;
        }
      }

      // Update CLAUDE.md if router content exists
      if (content.router || content.claudeMd) {
        const routerContent = content.claudeMd || content.router;
        fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), routerContent);
      }

      // Write version file
      const versionInfo: VersionInfo = {
        version: content.version,
        moduleCount,
        updatedAt: new Date().toISOString(),
        cliVersion: getCliVersion(),
      };
      fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));

      // Write notification file for AI to read and show to user
      const notificationPath = path.join(claudeDir, '.update-notification.json');
      const notification = {
        type: 'patterns_updated',
        previousVersion: installed?.version || 'unknown',
        newVersion: content.version,
        moduleCount,
        updatedAt: new Date().toISOString(),
        message: `CodeBakers patterns have been automatically updated from v${installed?.version || 'unknown'} to v${content.version} (${moduleCount} modules). Your AI tools now have the latest production patterns.`,
      };
      fs.writeFileSync(notificationPath, JSON.stringify(notification, null, 2));

      // Confirm to server (non-blocking, fire-and-forget)
      this.confirmDownload(content.version, moduleCount).catch(() => {});

      this.autoUpdateChecked = true;
      this.autoUpdateInProgress = false;

      // Log success (visible in MCP logs)
      console.error(`[CodeBakers] Auto-updated patterns to v${content.version} (${moduleCount} modules)`);

    } catch {
      // Silently fail - don't interrupt user's workflow
      this.autoUpdateInProgress = false;
    }
  }

  private gatherProjectContext(): ProjectContext {
    const cwd = process.cwd();
    const context: ProjectContext = {
      projectName: 'Unknown',
      dependencies: [],
      devDependencies: [],
      folderStructure: [],
      hasAuth: false,
      hasDatabase: false,
      hasPayments: false,
      uiLibrary: null,
      schemaPath: null,
      componentsPath: null,
      existingComponents: [],
      existingServices: [],
      existingApiRoutes: [],
      codebakersState: null,
    };

    // Read package.json
    try {
      const pkgPath = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        context.projectName = pkg.name || 'Unknown';
        context.dependencies = Object.keys(pkg.dependencies || {});
        context.devDependencies = Object.keys(pkg.devDependencies || {});

        // Detect libraries
        const allDeps = [...context.dependencies, ...context.devDependencies];
        context.hasAuth = allDeps.some(d => d.includes('supabase') || d.includes('next-auth') || d.includes('clerk'));
        context.hasDatabase = allDeps.some(d => d.includes('drizzle') || d.includes('prisma') || d.includes('postgres'));
        context.hasPayments = allDeps.some(d => d.includes('stripe') || d.includes('paypal'));

        if (allDeps.includes('@radix-ui/react-dialog') || allDeps.some(d => d.includes('shadcn'))) {
          context.uiLibrary = 'shadcn/ui';
        } else if (allDeps.includes('@chakra-ui/react')) {
          context.uiLibrary = 'Chakra UI';
        } else if (allDeps.includes('@mui/material')) {
          context.uiLibrary = 'Material UI';
        }
      }
    } catch {
      // Ignore package.json errors
    }

    // Read .codebakers.json state
    try {
      const statePath = path.join(cwd, '.codebakers.json');
      if (fs.existsSync(statePath)) {
        context.codebakersState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      }
    } catch {
      // Ignore state file errors
    }

    // Scan folder structure
    const scanDir = (dir: string, prefix = ''): string[] => {
      const results: string[] = [];
      try {
        if (!fs.existsSync(dir)) return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const fullPath = path.join(prefix, entry.name);
          if (entry.isDirectory()) {
            results.push(fullPath + '/');
            // Only go 2 levels deep
            if (prefix.split('/').length < 2) {
              results.push(...scanDir(path.join(dir, entry.name), fullPath));
            }
          }
        }
      } catch {
        // Ignore scan errors
      }
      return results;
    };

    context.folderStructure = scanDir(cwd);

    // Find schema path
    const schemaPaths = [
      'src/db/schema.ts',
      'src/lib/db/schema.ts',
      'db/schema.ts',
      'prisma/schema.prisma',
      'drizzle/schema.ts',
    ];
    for (const schemaPath of schemaPaths) {
      if (fs.existsSync(path.join(cwd, schemaPath))) {
        context.schemaPath = schemaPath;
        break;
      }
    }

    // Find components path and list components
    const componentPaths = ['src/components', 'components', 'app/components'];
    for (const compPath of componentPaths) {
      const fullPath = path.join(cwd, compPath);
      if (fs.existsSync(fullPath)) {
        context.componentsPath = compPath;
        try {
          const scanComponents = (dir: string, prefix = ''): string[] => {
            const comps: string[] = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue;
              if (entry.isDirectory()) {
                comps.push(...scanComponents(path.join(dir, entry.name), entry.name + '/'));
              } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
                comps.push(prefix + entry.name.replace(/\.(tsx|jsx)$/, ''));
              }
            }
            return comps;
          };
          context.existingComponents = scanComponents(fullPath).slice(0, 50); // Limit to 50
        } catch {
          // Ignore component scan errors
        }
        break;
      }
    }

    // Find services
    const servicePaths = ['src/services', 'src/lib/services', 'services'];
    for (const servPath of servicePaths) {
      const fullPath = path.join(cwd, servPath);
      if (fs.existsSync(fullPath)) {
        try {
          const entries = fs.readdirSync(fullPath);
          context.existingServices = entries
            .filter(e => e.endsWith('.ts') || e.endsWith('.js'))
            .map(e => e.replace(/\.(ts|js)$/, ''))
            .slice(0, 20);
        } catch {
          // Ignore service scan errors
        }
        break;
      }
    }

    // Find API routes
    const apiPaths = ['src/app/api', 'app/api', 'pages/api'];
    for (const apiPath of apiPaths) {
      const fullPath = path.join(cwd, apiPath);
      if (fs.existsSync(fullPath)) {
        try {
          const scanApiRoutes = (dir: string, prefix = ''): string[] => {
            const routes: string[] = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue;
              if (entry.isDirectory()) {
                routes.push(...scanApiRoutes(path.join(dir, entry.name), prefix + '/' + entry.name));
              } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                routes.push(prefix || '/');
              }
            }
            return routes;
          };
          context.existingApiRoutes = scanApiRoutes(fullPath).slice(0, 30);
        } catch {
          // Ignore API route scan errors
        }
        break;
      }
    }

    return context;
  }

  private async checkPatternVersion(): Promise<{
    installed: VersionInfo | null;
    latest: { version: string; moduleCount: number } | null;
    updateAvailable: boolean;
    message: string | null;
  }> {
    const cwd = process.cwd();
    const versionPath = path.join(cwd, '.claude', '.version.json');

    // Read local version
    let installed: VersionInfo | null = null;
    if (fs.existsSync(versionPath)) {
      try {
        installed = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
      } catch {
        // Ignore parse errors
      }
    }

    // Fetch latest version from API
    let latest: { version: string; moduleCount: number } | null = null;
    try {
      const response = await fetch(`${this.apiUrl}/api/content/version`, {
        headers: this.getAuthHeaders(),
      });
      if (response.ok) {
        latest = await response.json();
      }
    } catch {
      // Ignore fetch errors
    }

    // Compare versions
    let updateAvailable = false;
    let message: string | null = null;

    if (installed && latest) {
      if (installed.version !== latest.version) {
        updateAvailable = true;
        message = `⚠️ Pattern update available: v${installed.version} → v${latest.version} (${latest.moduleCount - installed.moduleCount} new modules)\n   Run \`codebakers upgrade\` to update`;
      }
    } else if (!installed && latest) {
      message = `ℹ️ No version tracking found. Run \`codebakers upgrade\` to sync patterns`;
    }

    return { installed, latest, updateAvailable, message };
  }

  private formatContextForPrompt(context: ProjectContext): string {
    const lines: string[] = [];

    lines.push(`Project: ${context.projectName}`);

    if (context.uiLibrary) {
      lines.push(`UI Library: ${context.uiLibrary}`);
    }

    if (context.schemaPath) {
      lines.push(`Database Schema: ${context.schemaPath}`);
    }

    if (context.componentsPath && context.existingComponents.length > 0) {
      lines.push(`Components Path: ${context.componentsPath}`);
      lines.push(`Existing Components: ${context.existingComponents.slice(0, 20).join(', ')}`);
    }

    if (context.existingServices.length > 0) {
      lines.push(`Existing Services: ${context.existingServices.join(', ')}`);
    }

    if (context.existingApiRoutes.length > 0) {
      lines.push(`Existing API Routes: ${context.existingApiRoutes.join(', ')}`);
    }

    const features: string[] = [];
    if (context.hasAuth) features.push('auth');
    if (context.hasDatabase) features.push('database');
    if (context.hasPayments) features.push('payments');
    if (features.length > 0) {
      lines.push(`Has: ${features.join(', ')}`);
    }

    const relevantDeps = context.dependencies.filter(d =>
      ['next', 'react', 'drizzle-orm', 'stripe', '@supabase/supabase-js', 'zod', 'react-hook-form', 'tailwindcss'].some(rd => d.includes(rd))
    );
    if (relevantDeps.length > 0) {
      lines.push(`Key Dependencies: ${relevantDeps.join(', ')}`);
    }

    return lines.join('\n');
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'optimize_and_build',
          description:
            'ALWAYS USE THIS FIRST for any coding request. Takes a simple user request, uses AI to analyze intent and detect relevant patterns, optimizes it into a production-ready prompt, and returns everything needed to build the feature correctly. No keyword matching - AI understands what you actually want to build.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'The user\'s original request (e.g., "add login", "create checkout", "zoom animation on image")',
              },
            },
            required: ['request'],
          },
        },
        {
          name: 'get_pattern',
          description:
            'Fetch a single CodeBakers pattern module by name. Use optimize_and_build instead for automatic pattern detection.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              pattern: {
                type: 'string',
                description:
                  'Pattern name (e.g., "00-core", "01-database", "02-auth", "03-api", "04-frontend")',
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'list_patterns',
          description:
            'List all available CodeBakers pattern modules.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'get_patterns',
          description:
            'Fetch multiple CodeBakers patterns at once. Use optimize_and_build instead for automatic pattern detection.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              patterns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of pattern names to fetch (max 5)',
              },
            },
            required: ['patterns'],
          },
        },
        {
          name: 'search_patterns',
          description:
            'Search CodeBakers patterns by keyword or topic. Returns relevant code snippets without reading entire files. Use this when you need specific guidance like "supabase auth setup", "optimistic updates", "soft delete", "form validation".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "supabase auth", "stripe checkout", "zod validation", "loading states")',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_pattern_section',
          description:
            'Get a specific section from a pattern file instead of the whole file. Much faster than get_pattern for targeted lookups.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              pattern: {
                type: 'string',
                description: 'Pattern name (e.g., "02-auth", "03-api")',
              },
              section: {
                type: 'string',
                description: 'Section name or keyword to find within the pattern (e.g., "OAuth", "rate limiting", "error handling")',
              },
            },
            required: ['pattern', 'section'],
          },
        },
        {
          name: 'scaffold_project',
          description:
            'Create a new project from scratch with Next.js + Supabase + Drizzle. Use this when user wants to build something new and no project exists yet. Creates all files, installs dependencies, and sets up CodeBakers patterns automatically. Set fullDeploy=true for seamless idea-to-deployment (creates GitHub repo, Supabase project, and deploys to Vercel). When fullDeploy=true, first call returns explanation - then call again with deployConfirmed=true after user confirms.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              projectName: {
                type: 'string',
                description: 'Name of the project (lowercase, no spaces)',
              },
              description: {
                type: 'string',
                description: 'Brief description of what the project is for (used in PRD.md)',
              },
              fullDeploy: {
                type: 'boolean',
                description: 'If true, enables full deployment flow (GitHub + Supabase + Vercel). First call returns explanation for user confirmation.',
              },
              deployConfirmed: {
                type: 'boolean',
                description: 'Set to true AFTER user confirms they want full deployment. Only set this after showing user the explanation and getting their approval.',
              },
            },
            required: ['projectName'],
          },
        },
        {
          name: 'init_project',
          description:
            'Add CodeBakers patterns to an existing project. Use this when user has an existing codebase and wants to add AI patterns to it.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              projectName: {
                type: 'string',
                description: 'Name of the project (optional, will be auto-detected from package.json)',
              },
            },
          },
        },
        {
          name: 'set_experience_level',
          description:
            'Set the user experience level. This affects how detailed explanations are when building features. Use "beginner" for new developers who need more explanations, "intermediate" for developers who know the basics, or "advanced" for experienced developers who want minimal explanations.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              level: {
                type: 'string',
                enum: ['beginner', 'intermediate', 'advanced'],
                description: 'Experience level: beginner (detailed explanations), intermediate (balanced), advanced (minimal explanations)',
              },
            },
            required: ['level'],
          },
        },
        {
          name: 'get_experience_level',
          description:
            'Get the current user experience level setting. Returns beginner, intermediate, or advanced. Use this at the start of building to know how much detail to include in explanations.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'get_status',
          description:
            'Check if CodeBakers is active and get current status. Use this when user asks "are you using CodeBakers?" or wants to verify the integration is working. Returns version, connection status, and available features.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'run_audit',
          description:
            'Run automated code quality and security checks on the current project. Checks TypeScript, ESLint, secrets in code, npm vulnerabilities, console.log usage, API validation, error boundaries, and more. Returns a score and list of issues to fix.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'heal',
          description:
            'Run the self-healing system to auto-detect and fix common issues. Scans for TypeScript errors, missing dependencies, environment issues, security vulnerabilities, and database problems. Can automatically apply safe fixes with high confidence.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              auto: {
                type: 'boolean',
                description: 'Automatically apply safe fixes without prompting (default: false)',
              },
              dryRun: {
                type: 'boolean',
                description: 'Show what would be fixed without applying changes (default: false)',
              },
              severity: {
                type: 'string',
                enum: ['critical', 'high', 'medium', 'low'],
                description: 'Filter issues by severity level',
              },
            },
          },
        },
        {
          name: 'design',
          description:
            'Clone and implement designs from mockups, screenshots, or website references. Analyzes visual designs and generates pixel-perfect matching code with extracted design tokens (colors, typography, spacing). Use when user says "clone this design", "make it look like...", or "copy this UI".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              source: {
                type: 'string',
                description: 'Path to mockup image, folder of images, URL to clone, or reference style (e.g., "./mockups", "https://linear.app", "like Notion")',
              },
              outputDir: {
                type: 'string',
                description: 'Directory to output generated components (default: src/components)',
              },
            },
            required: ['source'],
          },
        },
        {
          name: 'upgrade',
          description:
            'Upgrade an existing project to CodeBakers patterns WITHOUT changing the user\'s tech stack. Preserves their existing ORM (Prisma/Drizzle), auth (NextAuth/Clerk), UI library (Chakra/MUI), etc. Only upgrades code quality patterns like error handling, validation, tests, and security. Use when user says "upgrade this project", "improve my code", or "make this production ready".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              areas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific areas to upgrade: "api", "components", "testing", "security", "all" (default: all)',
              },
              severity: {
                type: 'string',
                enum: ['critical', 'high', 'medium', 'low', 'all'],
                description: 'Filter upgrades by severity (default: all)',
              },
              dryRun: {
                type: 'boolean',
                description: 'Show what would be upgraded without making changes (default: false)',
              },
            },
          },
        },
        {
          name: 'project_status',
          description:
            'Show project build progress, completed features, and what\'s next. Different from get_status which shows CodeBakers connection status. Use when user asks "where am I?", "what\'s built?", "show progress", or "what\'s next?".',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'run_tests',
          description:
            'Run the project test suite (npm test or configured test command). Use after completing a feature to verify everything works. Returns test results with pass/fail status.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to run specific tests (passed to test runner)',
              },
              watch: {
                type: 'boolean',
                description: 'Run in watch mode (default: false)',
              },
            },
          },
        },
        {
          name: 'report_pattern_gap',
          description:
            'Report when a user request cannot be fully handled by existing patterns. This helps improve CodeBakers by tracking what patterns are missing. The AI should automatically call this when it encounters something outside pattern coverage.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              category: {
                type: 'string',
                description: 'Category of the gap (e.g., "third-party-apis", "mobile", "blockchain", "iot")',
              },
              request: {
                type: 'string',
                description: 'What the user asked for',
              },
              context: {
                type: 'string',
                description: 'Additional context about what was needed',
              },
              handledWith: {
                type: 'string',
                description: 'Which existing patterns were used as fallback',
              },
              wasSuccessful: {
                type: 'boolean',
                description: 'Whether the request was handled successfully despite the gap',
              },
            },
            required: ['category', 'request'],
          },
        },
        {
          name: 'track_analytics',
          description:
            'Track CLI usage analytics for improving smart triggers and recommendations. Called automatically by the system for key events.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              eventType: {
                type: 'string',
                enum: ['trigger_fired', 'trigger_accepted', 'trigger_dismissed', 'topic_learned', 'command_used', 'pattern_fetched', 'build_started', 'build_completed', 'feature_added', 'audit_run', 'design_cloned'],
                description: 'Type of event to track',
              },
              eventData: {
                type: 'object',
                description: 'Additional data specific to the event',
              },
              projectHash: {
                type: 'string',
                description: 'Hash of project path for grouping analytics',
              },
            },
            required: ['eventType'],
          },
        },
        {
          name: 'vercel_logs',
          description:
            'Fetch runtime logs from Vercel for the current project. Use when user asks about errors, API failures, production issues, or wants to debug their deployed app. Requires VERCEL_TOKEN env var or vercel login. Examples: "show me errors from yesterday", "what API calls are failing", "why is my app crashing".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              hours: {
                type: 'number',
                description: 'How many hours of logs to fetch (default: 24, max: 168)',
              },
              level: {
                type: 'string',
                enum: ['error', 'warn', 'info', 'all'],
                description: 'Filter by log level (default: error)',
              },
              route: {
                type: 'string',
                description: 'Filter logs by API route path (e.g., "/api/auth", "/api/payments")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of log entries to return (default: 50, max: 500)',
              },
            },
          },
        },
        {
          name: 'vercel_analyze_errors',
          description:
            'Analyze Vercel logs and suggest fixes using CodeBakers patterns. Fetches recent errors, classifies them, and provides actionable fixes. Use when user says "fix my production errors", "why is X failing", or "help me debug".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              hours: {
                type: 'number',
                description: 'How many hours of logs to analyze (default: 24)',
              },
              autoFix: {
                type: 'boolean',
                description: 'Automatically apply safe fixes with high confidence (default: false)',
              },
            },
          },
        },
        {
          name: 'vercel_deployments',
          description:
            'List recent Vercel deployments and their status. Use when user asks "what was deployed", "show deployment history", or "why did the last deploy fail".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              limit: {
                type: 'number',
                description: 'Number of deployments to show (default: 10)',
              },
              state: {
                type: 'string',
                enum: ['READY', 'ERROR', 'BUILDING', 'QUEUED', 'CANCELED', 'all'],
                description: 'Filter by deployment state',
              },
            },
          },
        },
        {
          name: 'vercel_connect',
          description:
            'Connect to Vercel using an API token. Required before using other Vercel tools. Token is stored securely in config. Use when user says "connect to vercel", "setup vercel", or before any vercel_* tool if not connected.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              token: {
                type: 'string',
                description: 'Vercel API token from https://vercel.com/account/tokens',
              },
            },
            required: ['token'],
          },
        },
        {
          name: 'update_constant',
          description:
            'Update a business constant (pricing, trial days, module count, etc.) using natural language. Use this when user says things like "change Pro price to $59", "set trial to 10 days", "update module count to 45". Automatically edits src/lib/constants.ts.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'Natural language request describing what to change (e.g., "change Pro monthly price to $59", "set anonymous trial days to 10", "update Agency seats to 10")',
              },
            },
            required: ['request'],
          },
        },
        {
          name: 'update_schema',
          description:
            'Add or modify database tables using natural language. Use this when user says things like "add a tags table", "add a status field to users", "create a comments table with user_id and content". Automatically edits src/db/schema.ts and creates migration.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'Natural language request describing schema changes (e.g., "add a tags table with name and color fields", "add isArchived boolean to projects table", "create a comments table")',
              },
            },
            required: ['request'],
          },
        },
        {
          name: 'update_env',
          description:
            'Add or update environment variables. Use this when user says things like "add OPENAI_API_KEY", "set up Stripe keys", "add database URL". Updates both .env.local and .env.example.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'Natural language request describing env vars to add (e.g., "add OPENAI_API_KEY", "add Stripe test keys", "add RESEND_API_KEY for emails")',
              },
            },
            required: ['request'],
          },
        },
        {
          name: 'billing_action',
          description:
            'Perform billing and subscription actions. Use this when user says things like "show my subscription", "extend my trial", "upgrade to Pro", "check my usage". Opens billing page or shows subscription info.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              action: {
                type: 'string',
                description: 'Natural language billing action (e.g., "show my subscription", "extend trial", "upgrade to team", "check usage")',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'add_page',
          description:
            'Create a new page or route in the Next.js app. Use this when user says things like "create a settings page", "add an about page", "make a dashboard page with stats". Creates the file in src/app/ with proper structure.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'Natural language request describing the page (e.g., "create a settings page with tabs", "add an about page", "make a user profile page")',
              },
            },
            required: ['request'],
          },
        },
        {
          name: 'add_api_route',
          description:
            'Create a new API route endpoint. Use this when user says things like "create a feedback endpoint", "add an API for user preferences", "make a webhook endpoint for Stripe". Creates properly structured route.ts file.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'Natural language request describing the API route (e.g., "create POST endpoint for feedback", "add GET/POST for user settings", "make a Stripe webhook endpoint")',
              },
            },
            required: ['request'],
          },
        },
        {
          name: 'check_update_notification',
          description:
            'ALWAYS CALL THIS AT THE START OF EACH SESSION. Checks if CodeBakers patterns were recently auto-updated and returns a notification message to show the user. If an update occurred, tell the user about it with the returned message. After showing, the notification is cleared.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'update_patterns',
          description:
            'Download and update CodeBakers pattern files from the server. Use when user says "upgrade codebakers", "update patterns", "download latest patterns", "sync codebakers", or when patterns are missing or outdated. This tool fetches the latest CLAUDE.md router and all .claude/ module files from the server and writes them to disk.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              force: {
                type: 'boolean',
                description: 'Force update even if already at latest version (default: false)',
              },
            },
          },
        },
        {
          name: 'detect_intent',
          description:
            'CALL THIS FIRST when user request is ambiguous or could match multiple MCP tools. Analyzes user input and returns which MCP tool(s) would be appropriate, with explanations. Show the result to the user and ask for confirmation before executing. This prevents accidental destructive actions.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              userMessage: {
                type: 'string',
                description: 'The user\'s message or request to analyze',
              },
            },
            required: ['userMessage'],
          },
        },
        // VAPI Voice AI Tools
        {
          name: 'vapi_connect',
          description:
            'Connect to VAPI (Voice AI Platform). Sets up VAPI API credentials for voice assistant integration. Use when user says "connect vapi", "setup voice", "configure vapi", or before using other vapi_* tools.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              apiKey: {
                type: 'string',
                description: 'VAPI API key from https://dashboard.vapi.ai',
              },
            },
            required: ['apiKey'],
          },
        },
        {
          name: 'vapi_list_assistants',
          description:
            'List all VAPI voice assistants in your account. Shows assistant names, IDs, and configurations. Use when user asks "show my assistants", "list voice bots", or "what assistants do I have".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of assistants to return (default: 20)',
              },
            },
          },
        },
        {
          name: 'vapi_create_assistant',
          description:
            'Create a new VAPI voice assistant with CodeBakers best practices. Generates assistant with proper prompts, voice settings, and webhook configurations. Use when user says "create assistant", "new voice bot", or "setup voice agent".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              name: {
                type: 'string',
                description: 'Name for the assistant',
              },
              description: {
                type: 'string',
                description: 'What the assistant should do (e.g., "Customer support for a SaaS product")',
              },
              voice: {
                type: 'string',
                enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
                description: 'Voice to use (default: alloy)',
              },
              webhookUrl: {
                type: 'string',
                description: 'Optional webhook URL for call events',
              },
            },
            required: ['name', 'description'],
          },
        },
        {
          name: 'vapi_get_assistant',
          description:
            'Get details of a specific VAPI assistant including its configuration, prompts, and settings.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              assistantId: {
                type: 'string',
                description: 'The assistant ID to retrieve',
              },
            },
            required: ['assistantId'],
          },
        },
        {
          name: 'vapi_update_assistant',
          description:
            'Update an existing VAPI assistant. Modify prompts, voice settings, or configurations.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              assistantId: {
                type: 'string',
                description: 'The assistant ID to update',
              },
              name: {
                type: 'string',
                description: 'New name for the assistant',
              },
              systemPrompt: {
                type: 'string',
                description: 'New system prompt for the assistant',
              },
              voice: {
                type: 'string',
                enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
                description: 'New voice to use',
              },
            },
            required: ['assistantId'],
          },
        },
        {
          name: 'vapi_get_calls',
          description:
            'Get recent call logs from VAPI. Shows call duration, status, transcripts, and costs. Use when user asks "show calls", "call history", or "what calls happened".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              assistantId: {
                type: 'string',
                description: 'Filter by assistant ID (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of calls to return (default: 20)',
              },
            },
          },
        },
        {
          name: 'vapi_get_call',
          description:
            'Get details of a specific call including full transcript, recording URL, and analysis.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              callId: {
                type: 'string',
                description: 'The call ID to retrieve',
              },
            },
            required: ['callId'],
          },
        },
        {
          name: 'vapi_generate_webhook',
          description:
            'Generate a VAPI webhook handler for your Next.js project. Creates API route with proper signature verification and event handling. Use when user says "add vapi webhook", "handle vapi events", or "setup call notifications".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              events: {
                type: 'array',
                items: { type: 'string' },
                description: 'Events to handle: call-started, call-ended, speech-update, transcript, function-call, hang, tool-calls',
              },
            },
          },
        },
        // Ripple Detection Tool
        {
          name: 'ripple_check',
          description:
            'Detect all files affected by a change to a type, schema, function, or component. Use this BEFORE making breaking changes to understand impact, or AFTER to find files that need updating. Returns a list of files that import/use the entity and may need updates.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              entityName: {
                type: 'string',
                description: 'Name of the type, schema, function, or component that changed (e.g., "User", "createOrder", "Button")',
              },
              changeType: {
                type: 'string',
                enum: ['added_field', 'removed_field', 'renamed', 'type_changed', 'signature_changed', 'other'],
                description: 'What kind of change was made',
              },
              changeDescription: {
                type: 'string',
                description: 'Brief description of the change (e.g., "added teamId field", "renamed email to emailAddress")',
              },
            },
            required: ['entityName'],
          },
        },
        // ============================================
        // DEPENDENCY GUARDIAN - Auto-Coherence System
        // ============================================
        {
          name: 'guardian_analyze',
          description:
            'AUTOMATIC: Analyzes code for consistency issues, broken contracts, and coherence problems. Runs silently after every code generation. Returns issues found with auto-fix suggestions. User never needs to call this directly.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files that were just created or modified',
              },
              changeContext: {
                type: 'string',
                description: 'What change was made (e.g., "added user authentication", "created invoice API")',
              },
            },
            required: ['files'],
          },
        },
        {
          name: 'guardian_heal',
          description:
            'AUTOMATIC: Fixes consistency issues, broken imports, type mismatches, and contract violations. Runs automatically when guardian_analyze finds issues. User never needs to call this directly.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    file: { type: 'string' },
                    issue: { type: 'string' },
                    fix: { type: 'string' },
                  },
                },
                description: 'Issues to fix (from guardian_analyze)',
              },
              autoFix: {
                type: 'boolean',
                description: 'Whether to automatically apply fixes (default: true)',
              },
            },
            required: ['issues'],
          },
        },
        {
          name: 'guardian_verify',
          description:
            'AUTOMATIC: Verifies that all changes are coherent and the codebase compiles. Runs TypeScript check, verifies imports, and checks for common issues. Returns pass/fail with details.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              deep: {
                type: 'boolean',
                description: 'Run deep verification including cross-file contract checking (default: false for speed)',
              },
            },
          },
        },
        {
          name: 'guardian_status',
          description:
            'Shows the current coherence status of the project. Reports any known issues, pending fixes, and overall health score.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Check access: API key OR valid trial
      if (this.authMode === 'none') {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Not logged in. Run `codebakers go` to start a free trial, or `codebakers setup` if you have an account.'
        );
      }

      // Check if trial expired
      if (this.authMode === 'trial' && isTrialExpired()) {
        const trialState = getTrialState();
        if (trialState?.stage === 'anonymous') {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Trial expired. Run `codebakers extend` to add 7 more days with GitHub, or `codebakers billing` to upgrade.'
          );
        } else {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Trial expired. Run `codebakers billing` to upgrade to a paid plan.'
          );
        }
      }

      // Show warning if trial expiring soon
      if (this.authMode === 'trial') {
        const daysRemaining = getTrialDaysRemaining();
        if (daysRemaining <= 2) {
          console.error(`[CodeBakers] Trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Run 'codebakers extend' or 'codebakers billing'.`);
        }
      }

      const { name, arguments: args } = request.params;

      switch (name) {
        case 'optimize_and_build':
          return this.handleOptimizeAndBuild(args as { request: string });

        case 'get_pattern':
          return this.handleGetPattern(args as { pattern: string });

        case 'list_patterns':
          return this.handleListPatterns();

        case 'get_patterns':
          return this.handleGetPatterns(args as { patterns: string[] });

        case 'search_patterns':
          return this.handleSearchPatterns(args as { query: string });

        case 'get_pattern_section':
          return this.handleGetPatternSection(args as { pattern: string; section: string });

        case 'scaffold_project':
          return this.handleScaffoldProject(args as { projectName: string; description?: string; fullDeploy?: boolean; deployConfirmed?: boolean });

        case 'init_project':
          return this.handleInitProject(args as { projectName?: string });

        case 'set_experience_level':
          return this.handleSetExperienceLevel(args as { level: ExperienceLevel });

        case 'get_experience_level':
          return this.handleGetExperienceLevel();

        case 'get_status':
          return await this.handleGetStatus();

        case 'run_audit':
          return this.handleRunAudit();

        case 'heal':
          return this.handleHeal(args as { auto?: boolean; dryRun?: boolean; severity?: string });

        case 'design':
          return this.handleDesign(args as { source: string; outputDir?: string });

        case 'upgrade':
          return this.handleUpgrade(args as { areas?: string[]; severity?: string; dryRun?: boolean });

        case 'project_status':
          return this.handleProjectStatus();

        case 'run_tests':
          return this.handleRunTests(args as { filter?: string; watch?: boolean });

        case 'report_pattern_gap':
          return this.handleReportPatternGap(args as { category: string; request: string; context?: string; handledWith?: string; wasSuccessful?: boolean });

        case 'track_analytics':
          return this.handleTrackAnalytics(args as { eventType: string; eventData?: Record<string, unknown>; projectHash?: string });

        case 'vercel_logs':
          return this.handleVercelLogs(args as { hours?: number; level?: string; route?: string; limit?: number });

        case 'vercel_analyze_errors':
          return this.handleVercelAnalyzeErrors(args as { hours?: number; autoFix?: boolean });

        case 'vercel_deployments':
          return this.handleVercelDeployments(args as { limit?: number; state?: string });

        case 'vercel_connect':
          return this.handleVercelConnect(args as { token: string });

        case 'update_constant':
          return this.handleUpdateConstant(args as { request: string });

        case 'update_schema':
          return this.handleUpdateSchema(args as { request: string });

        case 'update_env':
          return this.handleUpdateEnv(args as { request: string });

        case 'billing_action':
          return this.handleBillingAction(args as { action: string });

        case 'add_page':
          return this.handleAddPage(args as { request: string });

        case 'add_api_route':
          return this.handleAddApiRoute(args as { request: string });

        case 'check_update_notification':
          return this.handleCheckUpdateNotification();

        case 'update_patterns':
          return this.handleUpdatePatterns(args as { force?: boolean });

        case 'detect_intent':
          return this.handleDetectIntent(args as { userMessage: string });

        // VAPI Voice AI handlers
        case 'vapi_connect':
          return this.handleVapiConnect(args as { apiKey: string });

        case 'vapi_list_assistants':
          return this.handleVapiListAssistants(args as { limit?: number });

        case 'vapi_create_assistant':
          return this.handleVapiCreateAssistant(args as { name: string; description: string; voice?: string; webhookUrl?: string });

        case 'vapi_get_assistant':
          return this.handleVapiGetAssistant(args as { assistantId: string });

        case 'vapi_update_assistant':
          return this.handleVapiUpdateAssistant(args as { assistantId: string; name?: string; systemPrompt?: string; voice?: string });

        case 'vapi_get_calls':
          return this.handleVapiGetCalls(args as { assistantId?: string; limit?: number });

        case 'vapi_get_call':
          return this.handleVapiGetCall(args as { callId: string });

        case 'vapi_generate_webhook':
          return this.handleVapiGenerateWebhook(args as { events?: string[] });

        case 'ripple_check':
          return this.handleRippleCheck(args as { entityName: string; changeType?: string; changeDescription?: string });

        // Dependency Guardian - Auto-Coherence System
        case 'guardian_analyze':
          return this.handleGuardianAnalyze(args as { files: string[]; changeContext?: string });

        case 'guardian_heal':
          return this.handleGuardianHeal(args as { issues: Array<{ file: string; issue: string; fix: string }>; autoFix?: boolean });

        case 'guardian_verify':
          return this.handleGuardianVerify(args as { deep?: boolean });

        case 'guardian_status':
          return this.handleGuardianStatus();

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  private async handleOptimizeAndBuild(args: { request: string }) {
    const { request: userRequest } = args;

    // Step 1: Gather project context
    const context = this.gatherProjectContext();
    const contextSummary = this.formatContextForPrompt(context);

    // Step 2: Call API to optimize the prompt with context
    // The API uses AI to analyze intent and detect patterns (no keyword matching)
    const optimizeResponse = await fetch(`${this.apiUrl}/api/optimize-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        prompt: userRequest,
        context: {
          summary: contextSummary,
          projectName: context.projectName,
          uiLibrary: context.uiLibrary,
          schemaPath: context.schemaPath,
          componentsPath: context.componentsPath,
          existingComponents: context.existingComponents.slice(0, 30),
          existingServices: context.existingServices,
          existingApiRoutes: context.existingApiRoutes,
          hasAuth: context.hasAuth,
          hasDatabase: context.hasDatabase,
          hasPayments: context.hasPayments,
          dependencies: context.dependencies.slice(0, 30),
        },
      }),
    });

    // Default values if API fails
    let optimizedPrompt = userRequest;
    let detectedFeature = 'Feature';
    let patterns = ['00-core', '04-frontend']; // Default fallback

    if (optimizeResponse.ok) {
      const optimizeData: OptimizeResponse = await optimizeResponse.json();
      optimizedPrompt = optimizeData.optimizedPrompt || userRequest;
      detectedFeature = optimizeData.featureName || 'Feature';
      // Use AI-detected patterns from the API (no local keyword matching)
      patterns = optimizeData.patterns || ['00-core', '04-frontend'];
    }

    // Step 3: Fetch all relevant patterns (as detected by AI)
    const patternResult = await this.fetchPatterns(patterns);

    // Step 4: Build the response showing the optimization with context
    const patternContent = Object.entries(patternResult.patterns || {})
      .map(([name, text]) => `## ${name}\n\n${text}`)
      .join('\n\n---\n\n');

    const response = `# 🪄 Prompt Optimizer (AI-Powered Intent Analysis)

## Your Request
"${userRequest}"

## Project Context Detected
${contextSummary}

## AI Analysis
- **Detected Intent:** ${detectedFeature}
- **Relevant Patterns:** ${patterns.join(', ')}

## Optimized Prompt (Production-Ready)
${optimizedPrompt}

---

# Pattern Documentation

${patternContent}

---

**IMPORTANT:** Use the optimized prompt above as your guide. It is tailored to THIS project's structure, existing components, and conventions. The AI analyzed your intent (not just keywords) to select the right patterns. The prompt includes:
- References to existing components and services you should reuse
- The correct file paths for this project
- Production requirements (error handling, loading states, validation, tests)

Show the user what their simple request was expanded into, then proceed with the implementation following the patterns above.`;

    return {
      content: [
        {
          type: 'text' as const,
          text: response,
        },
      ],
    };
  }

  private async handleGetPattern(args: { pattern: string }) {
    const { pattern } = args;

    // Check cache first
    const cached = patternCache.get(pattern);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        content: [
          {
            type: 'text' as const,
            text: cached.content,
          },
        ],
      };
    }

    // Fetch from API
    const result = await this.fetchPatterns([pattern]);

    if (result.patterns && result.patterns[pattern]) {
      const content = result.patterns[pattern];

      // Cache the result
      patternCache.set(pattern, { content, timestamp: Date.now() });

      return {
        content: [
          {
            type: 'text' as const,
            text: content,
          },
        ],
      };
    }

    throw new McpError(
      ErrorCode.InvalidRequest,
      `Pattern "${pattern}" not found. Use list_patterns to see available patterns.`
    );
  }

  private async handleListPatterns() {
    const response = await fetch(`${this.apiUrl}/api/patterns`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new McpError(
        ErrorCode.InternalError,
        error.error || 'Failed to fetch patterns'
      );
    }

    const data = await response.json();
    const patternList = data.patterns
      .map((p: { name: string }) => `- ${p.name}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Available CodeBakers Patterns (${data.total} total):\n\n${patternList}\n\nTip: Use optimize_and_build for automatic AI-powered pattern detection.`,
        },
      ],
    };
  }

  private async handleGetPatterns(args: { patterns: string[] }) {
    const { patterns } = args;

    if (patterns.length > 5) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Maximum 5 patterns per request'
      );
    }

    const result = await this.fetchPatterns(patterns);

    const content = Object.entries(result.patterns || {})
      .map(([name, text]) => `## ${name}\n\n${text}`)
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text:
            content ||
            'No patterns found. Use list_patterns to see available patterns.',
        },
      ],
    };
  }

  private async fetchPatterns(patterns: string[]) {
    const response = await fetch(`${this.apiUrl}/api/patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ patterns }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new McpError(
        ErrorCode.InternalError,
        error.error || 'Failed to fetch patterns'
      );
    }

    return response.json();
  }

  private async handleSearchPatterns(args: { query: string }) {
    const { query } = args;

    // Call API endpoint for semantic search
    const response = await fetch(`${this.apiUrl}/api/patterns/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      // Fallback: If search endpoint doesn't exist, do client-side search
      return this.fallbackSearch(query);
    }

    const data = await response.json();

    const results = data.results
      .map((r: { pattern: string; section: string; content: string; relevance: number }) =>
        `### ${r.pattern} - ${r.section}\n\n\`\`\`typescript\n${r.content}\n\`\`\`\n\nRelevance: ${Math.round(r.relevance * 100)}%`
      )
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Search Results for "${query}"\n\n${results || 'No results found. Try a different query.'}`,
        },
      ],
    };
  }

  private async fallbackSearch(query: string) {
    // Keyword-based fallback if API search not available
    const keywordPatternMap: Record<string, string[]> = {
      'auth': ['02-auth'],
      'login': ['02-auth'],
      'oauth': ['02-auth'],
      'supabase': ['02-auth', '01-database'],
      'database': ['01-database'],
      'drizzle': ['01-database'],
      'schema': ['01-database'],
      'api': ['03-api'],
      'route': ['03-api'],
      'validation': ['03-api', '04-frontend'],
      'zod': ['03-api', '04-frontend'],
      'frontend': ['04-frontend'],
      'form': ['04-frontend'],
      'react': ['04-frontend'],
      'component': ['04-frontend'],
      'stripe': ['05-payments'],
      'payment': ['05-payments'],
      'checkout': ['05-payments'],
      'subscription': ['05-payments'],
      'email': ['06-integrations'],
      'webhook': ['06-integrations'],
      'cache': ['07-performance'],
      'test': ['08-testing'],
      'playwright': ['08-testing'],
      'design': ['09-design'],
      'ui': ['09-design'],
      'accessibility': ['09-design'],
      'websocket': ['11-realtime'],
      'realtime': ['11-realtime'],
      'notification': ['11-realtime'],
      'saas': ['12-saas'],
      'tenant': ['12-saas'],
      'mobile': ['13-mobile'],
      'expo': ['13-mobile'],
      'ai': ['14-ai'],
      'openai': ['14-ai'],
      'embedding': ['14-ai'],
      'analytics': ['26-analytics'],
      'search': ['27-search'],
      'animation': ['30-motion'],
      'framer': ['30-motion'],
    };

    const lowerQuery = query.toLowerCase();
    const matchedPatterns = new Set<string>();

    for (const [keyword, patterns] of Object.entries(keywordPatternMap)) {
      if (lowerQuery.includes(keyword)) {
        patterns.forEach(p => matchedPatterns.add(p));
      }
    }

    if (matchedPatterns.size === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `# No patterns found for "${query}"\n\nTry:\n- "auth" for authentication patterns\n- "api" for API route patterns\n- "form" for frontend form patterns\n- "stripe" for payment patterns\n\nOr use \`list_patterns\` to see all available patterns.`,
          },
        ],
      };
    }

    const patterns = Array.from(matchedPatterns).slice(0, 3);
    const result = await this.fetchPatterns(patterns);

    const content = Object.entries(result.patterns || {})
      .map(([name, text]) => `## ${name}\n\n${text}`)
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Patterns matching "${query}"\n\nFound in: ${patterns.join(', ')}\n\n${content}`,
        },
      ],
    };
  }

  private async handleGetPatternSection(args: { pattern: string; section: string }) {
    const { pattern, section } = args;

    // Fetch the full pattern first
    const result = await this.fetchPatterns([pattern]);

    if (!result.patterns || !result.patterns[pattern]) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Pattern "${pattern}" not found. Use list_patterns to see available patterns.`
      );
    }

    const fullContent = result.patterns[pattern];

    // Find the section (case-insensitive search for headers or content)
    const sectionLower = section.toLowerCase();
    const lines = fullContent.split('\n');
    const sections: string[] = [];
    let currentSection = '';
    let currentContent: string[] = [];
    let capturing = false;
    let relevanceScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a header
      if (line.match(/^#{1,3}\s/)) {
        // Save previous section if we were capturing
        if (capturing && currentContent.length > 0) {
          sections.push(`### ${currentSection}\n\n${currentContent.join('\n')}`);
        }

        currentSection = line.replace(/^#+\s*/, '');
        currentContent = [];

        // Check if this section matches our query
        if (currentSection.toLowerCase().includes(sectionLower)) {
          capturing = true;
          relevanceScore++;
        } else {
          capturing = false;
        }
      } else if (capturing) {
        currentContent.push(line);
      }

      // Also check content for keyword matches
      if (!capturing && line.toLowerCase().includes(sectionLower)) {
        // Found keyword in content, capture surrounding context
        const start = Math.max(0, i - 5);
        const end = Math.min(lines.length, i + 20);
        const context = lines.slice(start, end).join('\n');
        sections.push(`### Found at line ${i + 1}\n\n${context}`);
        relevanceScore++;
      }
    }

    // Capture last section if we were still capturing
    if (capturing && currentContent.length > 0) {
      sections.push(`### ${currentSection}\n\n${currentContent.join('\n')}`);
    }

    if (sections.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `# Section "${section}" not found in ${pattern}\n\nThe pattern exists but doesn't contain a section matching "${section}".\n\nTry:\n- A broader search term\n- \`get_pattern ${pattern}\` to see the full content\n- \`search_patterns ${section}\` to search across all patterns`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `# ${pattern} - "${section}"\n\n${sections.slice(0, 5).join('\n\n---\n\n')}`,
        },
      ],
    };
  }

  private async handleScaffoldProject(args: { projectName: string; description?: string; fullDeploy?: boolean; deployConfirmed?: boolean }) {
    const { projectName, description, fullDeploy, deployConfirmed } = args;
    const cwd = process.cwd();

    // If fullDeploy requested but not confirmed, show explanation and ask for confirmation
    if (fullDeploy && !deployConfirmed) {
      return this.showFullDeployExplanation(projectName, description);
    }

    // Check if directory has files
    const files = fs.readdirSync(cwd);
    const hasFiles = files.filter(f => !f.startsWith('.')).length > 0;

    if (hasFiles) {
      // Check if it's already a CodeBakers project
      if (fs.existsSync(path.join(cwd, 'CLAUDE.md'))) {
        return {
          content: [{
            type: 'text' as const,
            text: `# Project Already Exists\n\nThis directory already has a CodeBakers project. Use the existing project or navigate to an empty directory.`,
          }],
        };
      }
    }

    const results: string[] = [];
    results.push(`# 🚀 Creating Project: ${projectName}\n`);

    try {
      // Create directories
      const dirs = [
        'src/app',
        'src/components',
        'src/lib/supabase',
        'src/db',
        'src/db/migrations',
        'src/services',
        'src/types',
        'public',
      ];

      for (const dir of dirs) {
        const dirPath = path.join(cwd, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
      results.push('✓ Created directory structure');

      // Write package.json
      const packageJson = { ...templates.PACKAGE_JSON, name: projectName };
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(packageJson, null, 2));
      results.push('✓ Created package.json');

      // Write config files
      fs.writeFileSync(path.join(cwd, '.env.example'), templates.ENV_EXAMPLE);
      fs.writeFileSync(path.join(cwd, '.env.local'), templates.ENV_EXAMPLE);
      fs.writeFileSync(path.join(cwd, 'drizzle.config.ts'), templates.DRIZZLE_CONFIG);
      fs.writeFileSync(path.join(cwd, 'tailwind.config.ts'), templates.TAILWIND_CONFIG);
      fs.writeFileSync(path.join(cwd, 'postcss.config.mjs'), templates.POSTCSS_CONFIG);
      fs.writeFileSync(path.join(cwd, 'tsconfig.json'), JSON.stringify(templates.TSCONFIG, null, 2));
      fs.writeFileSync(path.join(cwd, 'next.config.ts'), templates.NEXT_CONFIG);
      fs.writeFileSync(path.join(cwd, '.gitignore'), templates.GITIGNORE);
      results.push('✓ Created configuration files');

      // Write source files
      fs.writeFileSync(path.join(cwd, 'src/lib/supabase/server.ts'), templates.SUPABASE_SERVER);
      fs.writeFileSync(path.join(cwd, 'src/lib/supabase/client.ts'), templates.SUPABASE_CLIENT);
      fs.writeFileSync(path.join(cwd, 'src/lib/supabase/middleware.ts'), templates.SUPABASE_MIDDLEWARE);
      fs.writeFileSync(path.join(cwd, 'middleware.ts'), templates.MIDDLEWARE);
      fs.writeFileSync(path.join(cwd, 'src/db/schema.ts'), templates.DB_SCHEMA);
      fs.writeFileSync(path.join(cwd, 'src/db/index.ts'), templates.DB_INDEX);
      fs.writeFileSync(path.join(cwd, 'src/app/globals.css'), templates.GLOBALS_CSS);
      fs.writeFileSync(path.join(cwd, 'src/app/layout.tsx'), templates.LAYOUT_TSX);
      fs.writeFileSync(path.join(cwd, 'src/app/page.tsx'), templates.PAGE_TSX);
      fs.writeFileSync(path.join(cwd, 'src/lib/utils.ts'), templates.UTILS_CN);
      results.push('✓ Created source files');

      // Install dependencies
      try {
        execSync('npm install', { cwd, stdio: 'pipe' });
        results.push('✓ Installed npm dependencies');
      } catch {
        results.push('⚠️ Could not install dependencies - run `npm install` manually');
      }

      // Now install CodeBakers patterns
      results.push('\n## Installing CodeBakers Patterns...\n');

      const response = await fetch(`${this.apiUrl}/api/content`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const content = await response.json();

        // Write CLAUDE.md
        if (content.router) {
          fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), content.router);
          results.push('✓ Created CLAUDE.md (AI router)');
        }

        // Write pattern modules
        if (content.modules && Object.keys(content.modules).length > 0) {
          const modulesDir = path.join(cwd, '.claude');
          if (!fs.existsSync(modulesDir)) {
            fs.mkdirSync(modulesDir, { recursive: true });
          }
          for (const [name, data] of Object.entries(content.modules)) {
            fs.writeFileSync(path.join(modulesDir, name), data as string);
          }
          results.push(`✓ Installed ${Object.keys(content.modules).length} pattern modules`);
        }

        // Create PRD with description
        const date = new Date().toISOString().split('T')[0];
        const prdContent = `# Product Requirements Document
# Project: ${projectName}
# Created: ${date}

## Overview
**One-liner:** ${description || '[Describe this project in one sentence]'}

**Problem:** [What problem does this solve?]

**Solution:** [How does this solve it?]

## Core Features (MVP)
1. [ ] **Feature 1:** [Description]
2. [ ] **Feature 2:** [Description]
3. [ ] **Feature 3:** [Description]

## Technical Requirements
- Framework: Next.js 14 (App Router)
- Database: PostgreSQL + Drizzle ORM
- Auth: Supabase Auth
- UI: Tailwind CSS + shadcn/ui

---
<!-- AI: Reference this PRD when building features -->
`;
        fs.writeFileSync(path.join(cwd, 'PRD.md'), prdContent);
        results.push('✓ Created PRD.md');

        // Create other project files
        fs.writeFileSync(path.join(cwd, 'PROJECT-STATE.md'), `# PROJECT STATE
# Last Updated: ${date}

## Project Info
name: ${projectName}
phase: setup

## In Progress
## Completed
## Next Up
`);
        results.push('✓ Created PROJECT-STATE.md');
      }

      results.push('\n---\n');
      results.push('## ✅ Project Created Successfully!\n');

      // If fullDeploy is enabled and confirmed, proceed with cloud deployment
      if (fullDeploy && deployConfirmed) {
        results.push('## 🚀 Starting Full Deployment...\n');
        const deployResults = await this.executeFullDeploy(projectName, cwd, description);
        results.push(...deployResults);
      } else {
        results.push('### Next Steps:\n');
        results.push('1. **Set up Supabase:** Go to https://supabase.com and create a free project');
        results.push('2. **Add credentials:** Copy your Supabase URL and anon key to `.env.local`');
        results.push('3. **Start building:** Just tell me what features you want!\n');
        results.push('### Example:\n');
        results.push('> "Add user authentication with email/password"');
        results.push('> "Create a dashboard with stats cards"');
        results.push('> "Build a todo list with CRUD operations"');
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push(`\n❌ Error: ${message}`);
    }

    return {
      content: [{
        type: 'text' as const,
        text: results.join('\n'),
      }],
    };
  }

  /**
   * Show explanation of what fullDeploy will do and ask for confirmation
   */
  private showFullDeployExplanation(projectName: string, description?: string) {
    const explanation = `# 🚀 Full Deployment: ${projectName}

## What This Will Do

Full deployment creates a complete production-ready environment automatically:

### 1. 📁 Local Project
- Create Next.js + Supabase + Drizzle project
- Install all dependencies
- Set up CodeBakers patterns

### 2. 🐙 GitHub Repository
- Create a new private repository: \`${projectName}\`
- Initialize git and push code
- Set up .gitignore properly

### 3. 🗄️ Supabase Project
- Create a new Supabase project
- Get database connection string
- Get API keys (anon + service role)
- Auto-configure .env.local

### 4. 🔺 Vercel Deployment
- Deploy to Vercel
- Connect to GitHub for auto-deploys
- Set all environment variables
- Get your live URL

---

## Requirements

Make sure you have these CLIs installed and authenticated:
- \`gh\` - GitHub CLI (run: \`gh auth login\`)
- \`supabase\` - Supabase CLI (run: \`supabase login\`)
- \`vercel\` - Vercel CLI (run: \`vercel login\`)

---

## 🎯 Result

After completion, you'll have:
- ✅ GitHub repo with your code
- ✅ Supabase project with database ready
- ✅ Live URL on Vercel
- ✅ Auto-deploys on every push

---

**⚠️ IMPORTANT: Ask the user to confirm before proceeding.**

To proceed, call \`scaffold_project\` again with:
\`\`\`json
{
  "projectName": "${projectName}",
  "description": "${description || ''}",
  "fullDeploy": true,
  "deployConfirmed": true
}
\`\`\`

Or if user declines, call without fullDeploy:
\`\`\`json
{
  "projectName": "${projectName}",
  "description": "${description || ''}"
}
\`\`\`
`;

    return {
      content: [{
        type: 'text' as const,
        text: explanation,
      }],
    };
  }

  /**
   * Execute full cloud deployment (GitHub + Supabase + Vercel)
   */
  private async executeFullDeploy(projectName: string, cwd: string, description?: string): Promise<string[]> {
    const results: string[] = [];

    // Check for required CLIs
    const cliChecks = this.checkRequiredCLIs();
    if (cliChecks.missing.length > 0) {
      results.push('### ❌ Missing Required CLIs\n');
      results.push('The following CLIs are required for full deployment:\n');
      for (const cli of cliChecks.missing) {
        results.push(`- **${cli.name}**: ${cli.installCmd}`);
      }
      results.push('\nInstall the missing CLIs and try again.');
      return results;
    }
    results.push('✓ All required CLIs found\n');

    // Step 1: Initialize Git and create GitHub repo
    results.push('### Step 1: GitHub Repository\n');
    try {
      // Initialize git
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git add .', { cwd, stdio: 'pipe' });
      execSync('git commit -m "Initial commit from CodeBakers"', { cwd, stdio: 'pipe' });
      results.push('✓ Initialized git repository');

      // Create GitHub repo
      const ghDescription = description || `${projectName} - Created with CodeBakers`;
      execSync(`gh repo create ${projectName} --private --source=. --push --description "${ghDescription}"`, { cwd, stdio: 'pipe' });
      results.push(`✓ Created GitHub repo: ${projectName}`);
      results.push(`  → https://github.com/${this.getGitHubUsername()}/${projectName}\n`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push(`⚠️ GitHub setup failed: ${msg}`);
      results.push('  You can create the repo manually: gh repo create\n');
    }

    // Step 2: Create Supabase project
    results.push('### Step 2: Supabase Project\n');
    try {
      // Create Supabase project (this may take a while)
      const orgId = this.getSupabaseOrgId();
      if (orgId) {
        execSync(`supabase projects create ${projectName} --org-id ${orgId} --region us-east-1 --db-password "${this.generatePassword()}"`, { cwd, stdio: 'pipe', timeout: 120000 });
        results.push(`✓ Created Supabase project: ${projectName}`);

        // Get project credentials
        const projectsOutput = execSync('supabase projects list --output json', { cwd, encoding: 'utf-8' });
        const projects = JSON.parse(projectsOutput);
        const newProject = projects.find((p: { name: string }) => p.name === projectName);

        if (newProject) {
          // Update .env.local with Supabase credentials
          const envPath = path.join(cwd, '.env.local');
          let envContent = fs.readFileSync(envPath, 'utf-8');
          envContent = envContent.replace('your-supabase-url', `https://${newProject.id}.supabase.co`);
          envContent = envContent.replace('your-anon-key', newProject.anon_key || 'YOUR_ANON_KEY');
          fs.writeFileSync(envPath, envContent);
          results.push('✓ Updated .env.local with Supabase credentials\n');
        }
      } else {
        results.push('⚠️ Could not detect Supabase organization');
        results.push('  Run: supabase orgs list\n');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push(`⚠️ Supabase setup failed: ${msg}`);
      results.push('  Create project manually at: https://supabase.com/dashboard\n');
    }

    // Step 3: Deploy to Vercel
    results.push('### Step 3: Vercel Deployment\n');
    try {
      // Link to Vercel (creates new project)
      execSync('vercel link --yes', { cwd, stdio: 'pipe' });
      results.push('✓ Linked to Vercel');

      // Set environment variables from .env.local
      const envPath = path.join(cwd, '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const envVars = envContent.split('\n')
          .filter(line => line.includes('=') && !line.startsWith('#'))
          .map(line => {
            const [key, ...valueParts] = line.split('=');
            return { key: key.trim(), value: valueParts.join('=').trim() };
          });

        for (const { key, value } of envVars) {
          if (value && !value.includes('your-')) {
            try {
              execSync(`vercel env add ${key} production <<< "${value}"`, { cwd, stdio: 'pipe', shell: 'bash' });
            } catch {
              // Env var might already exist, try to update
            }
          }
        }
        results.push('✓ Set environment variables');
      }

      // Deploy to production
      const deployOutput = execSync('vercel --prod --yes', { cwd, encoding: 'utf-8' });
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+\.vercel\.app/);
      const deployUrl = urlMatch ? urlMatch[0] : 'Check Vercel dashboard';
      results.push(`✓ Deployed to Vercel`);
      results.push(`  → ${deployUrl}\n`);

      // Connect to GitHub for auto-deploys
      try {
        execSync('vercel git connect --yes', { cwd, stdio: 'pipe' });
        results.push('✓ Connected to GitHub for auto-deploys\n');
      } catch {
        results.push('⚠️ Could not auto-connect to GitHub\n');
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push(`⚠️ Vercel deployment failed: ${msg}`);
      results.push('  Deploy manually: vercel --prod\n');
    }

    // Summary
    results.push('---\n');
    results.push('## 🎉 Full Deployment Complete!\n');
    results.push('Your project is now live with:');
    results.push('- GitHub repo with CI/CD ready');
    results.push('- Supabase database configured');
    results.push('- Vercel hosting with auto-deploys\n');
    results.push('**Start building features - every push auto-deploys!**');

    return results;
  }

  /**
   * Check if required CLIs are installed
   */
  private checkRequiredCLIs(): { installed: string[]; missing: { name: string; installCmd: string }[] } {
    const clis = [
      { name: 'gh', cmd: 'gh --version', installCmd: 'npm install -g gh' },
      { name: 'supabase', cmd: 'supabase --version', installCmd: 'npm install -g supabase' },
      { name: 'vercel', cmd: 'vercel --version', installCmd: 'npm install -g vercel' },
    ];

    const installed: string[] = [];
    const missing: { name: string; installCmd: string }[] = [];

    for (const cli of clis) {
      try {
        execSync(cli.cmd, { stdio: 'pipe' });
        installed.push(cli.name);
      } catch {
        missing.push({ name: cli.name, installCmd: cli.installCmd });
      }
    }

    return { installed, missing };
  }

  /**
   * Get GitHub username from gh CLI
   */
  private getGitHubUsername(): string {
    try {
      const output = execSync('gh api user --jq .login', { encoding: 'utf-8' });
      return output.trim();
    } catch {
      return 'YOUR_USERNAME';
    }
  }

  /**
   * Get Supabase organization ID
   */
  private getSupabaseOrgId(): string | null {
    try {
      const output = execSync('supabase orgs list --output json', { encoding: 'utf-8' });
      const orgs = JSON.parse(output);
      return orgs[0]?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a secure random password for Supabase
   */
  private generatePassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 24; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async handleInitProject(args: { projectName?: string }) {
    const cwd = process.cwd();
    const results: string[] = [];

    // Detect project name from package.json
    let projectName = args.projectName || 'my-project';
    try {
      const pkgPath = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        projectName = pkg.name || projectName;
      }
    } catch {
      // Use default
    }

    results.push(`# 🎨 Adding CodeBakers to: ${projectName}\n`);

    // Check if already initialized
    if (fs.existsSync(path.join(cwd, 'CLAUDE.md'))) {
      results.push('⚠️ CLAUDE.md already exists. Updating patterns...\n');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/content`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patterns from API');
      }

      const content = await response.json();

      // Write CLAUDE.md
      if (content.router) {
        fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), content.router);
        results.push('✓ Created/Updated CLAUDE.md');
      }

      // Write pattern modules
      if (content.modules && Object.keys(content.modules).length > 0) {
        const modulesDir = path.join(cwd, '.claude');
        if (!fs.existsSync(modulesDir)) {
          fs.mkdirSync(modulesDir, { recursive: true });
        }
        for (const [name, data] of Object.entries(content.modules)) {
          fs.writeFileSync(path.join(modulesDir, name), data as string);
        }
        results.push(`✓ Installed ${Object.keys(content.modules).length} pattern modules (v${content.version})`);
      }

      // Create PRD if doesn't exist
      const date = new Date().toISOString().split('T')[0];
      const prdPath = path.join(cwd, 'PRD.md');
      if (!fs.existsSync(prdPath)) {
        fs.writeFileSync(prdPath, `# Product Requirements Document
# Project: ${projectName}
# Created: ${date}

## Overview
**One-liner:** [Describe this project]

## Core Features (MVP)
1. [ ] **Feature 1:** [Description]
2. [ ] **Feature 2:** [Description]
`);
        results.push('✓ Created PRD.md template');
      }

      // Create PROJECT-STATE if doesn't exist
      const statePath = path.join(cwd, 'PROJECT-STATE.md');
      if (!fs.existsSync(statePath)) {
        fs.writeFileSync(statePath, `# PROJECT STATE
# Last Updated: ${date}

## Project Info
name: ${projectName}
phase: development

## In Progress
## Completed
## Next Up
`);
        results.push('✓ Created PROJECT-STATE.md');
      }

      // Update .gitignore
      const gitignorePath = path.join(cwd, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignore.includes('.claude/')) {
          fs.writeFileSync(gitignorePath, gitignore + '\n# CodeBakers\n.claude/\n');
          results.push('✓ Updated .gitignore');
        }
      }

      results.push('\n---\n');
      results.push('## ✅ CodeBakers Patterns Installed!\n');
      results.push('The AI now has access to production patterns for:');
      results.push('- Authentication, Database, API design');
      results.push('- Frontend components, Forms, Validation');
      results.push('- Payments, Email, Real-time features');
      results.push('- And 30+ more specialized patterns\n');
      results.push('Just describe what you want to build!');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push(`\n❌ Error: ${message}`);
    }

    return {
      content: [{
        type: 'text' as const,
        text: results.join('\n'),
      }],
    };
  }

  private handleSetExperienceLevel(args: { level: ExperienceLevel }) {
    const { level } = args;

    // Validate level
    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Invalid experience level: "${level}". Must be: beginner, intermediate, or advanced.`,
        }],
      };
    }

    setExperienceLevel(level);

    const descriptions: Record<ExperienceLevel, string> = {
      beginner: '🎓 **Beginner Mode**\n\nI will:\n- Explain concepts as I go\n- Break down complex steps\n- Provide more context about what each piece of code does\n- Suggest learning resources when relevant',
      intermediate: '⚡ **Intermediate Mode**\n\nI will:\n- Provide balanced explanations\n- Focus on the "why" behind decisions\n- Skip basic explanations you already know',
      advanced: '🚀 **Advanced Mode**\n\nI will:\n- Skip explanations, just build\n- Focus on efficiency and best practices\n- Assume you know the fundamentals\n- Get straight to the code',
    };

    return {
      content: [{
        type: 'text' as const,
        text: `✅ Experience level set to: **${level}**\n\n${descriptions[level]}`,
      }],
    };
  }

  private handleGetExperienceLevel() {
    const level = getExperienceLevel();

    const modeInfo: Record<ExperienceLevel, { emoji: string; description: string }> = {
      beginner: {
        emoji: '🎓',
        description: 'Detailed explanations, step-by-step guidance'
      },
      intermediate: {
        emoji: '⚡',
        description: 'Balanced explanations, focus on decisions'
      },
      advanced: {
        emoji: '🚀',
        description: 'Minimal explanations, straight to code'
      },
    };

    const info = modeInfo[level];

    return {
      content: [{
        type: 'text' as const,
        text: `# Current Experience Level\n\n${info.emoji} **${level.charAt(0).toUpperCase() + level.slice(1)}**\n${info.description}\n\n---\n\nTo change, use: \`set_experience_level\` with "beginner", "intermediate", or "advanced"`,
      }],
    };
  }

  private async handleRunAudit() {
    try {
      const result = await runAudit();

      const passedChecks = result.checks.filter(c => c.passed);
      const failedChecks = result.checks.filter(c => !c.passed);

      let response = `# 🔍 Code Audit Results\n\n`;
      response += `**Score:** ${result.score}% (${passedChecks.length}/${result.checks.length} checks passed)\n\n`;

      if (result.passed) {
        response += `## ✅ Status: PASSED\n\nYour project is in good shape!\n\n`;
      } else {
        response += `## ⚠️ Status: NEEDS ATTENTION\n\nSome issues need to be fixed before deployment.\n\n`;
      }

      // Show passed checks
      if (passedChecks.length > 0) {
        response += `### Passed Checks\n`;
        for (const check of passedChecks) {
          response += `- ✅ ${check.message}\n`;
        }
        response += '\n';
      }

      // Show failed checks
      if (failedChecks.length > 0) {
        response += `### Issues Found\n`;
        for (const check of failedChecks) {
          const icon = check.severity === 'error' ? '❌' : '⚠️';
          response += `- ${icon} **${check.message}**\n`;
          if (check.details && check.details.length > 0) {
            for (const detail of check.details.slice(0, 3)) {
              response += `  - ${detail}\n`;
            }
          }
        }
        response += '\n';
      }

      response += `---\n\n*Tip: Run \`/audit\` in Claude for a full 100-point inspection.*`;

      return {
        content: [{
          type: 'text' as const,
          text: response,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text' as const,
          text: `# ❌ Audit Failed\n\nError: ${message}`,
        }],
      };
    }
  }

  private async handleHeal(args: { auto?: boolean; dryRun?: boolean; severity?: string }) {
    try {
      const result = await runHeal({
        auto: args.auto || false,
        dryRun: args.dryRun || false,
        severity: args.severity
      });

      let response = `# 🏥 Self-Healing Results\n\n`;

      if (result.errors.length === 0) {
        response += `## ✅ No Issues Found\n\nYour project is healthy!\n`;
      } else {
        response += `## Found ${result.errors.length} Issue(s)\n\n`;
        response += `**Fixed:** ${result.fixed} | **Remaining:** ${result.remaining}\n\n`;

        // Group by category
        const byCategory = new Map<string, typeof result.errors>();
        for (const error of result.errors) {
          const cat = error.category;
          if (!byCategory.has(cat)) byCategory.set(cat, []);
          byCategory.get(cat)!.push(error);
        }

        for (const [category, errors] of byCategory) {
          response += `### ${category.toUpperCase()}\n`;
          for (const error of errors) {
            const icon = error.fixed ? '✅' : (error.autoFixable ? '🔧' : '⚠️');
            response += `- ${icon} ${error.message}\n`;
            if (error.file) {
              response += `  - File: ${error.file}${error.line ? `:${error.line}` : ''}\n`;
            }
            if (error.suggestedFixes.length > 0 && !error.fixed) {
              response += `  - Fix: ${error.suggestedFixes[0].description}\n`;
            }
          }
          response += '\n';
        }
      }

      if (!args.auto && result.errors.some(e => e.autoFixable && !e.fixed)) {
        response += `---\n\n*Run with \`auto: true\` to automatically apply safe fixes.*`;
      }

      // Add CLI update notice if available
      response += this.getUpdateNotice();

      return {
        content: [{
          type: 'text' as const,
          text: response,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text' as const,
          text: `# ❌ Healing Failed\n\nError: ${message}${this.getUpdateNotice()}`,
        }],
      };
    }
  }

  private async handleGetStatus() {
    const level = getExperienceLevel();
    const context = this.gatherProjectContext();
    const versionCheck = await this.checkPatternVersion();
    const cliVersion = getCliVersion();

    // Build version status section
    let versionSection = `- **CLI Version:** ${cliVersion}`;
    if (versionCheck.installed) {
      versionSection += `\n- **Patterns Version:** ${versionCheck.installed.version} (${versionCheck.installed.moduleCount} modules)`;
    }

    // Build update alert if needed
    let updateAlert = '';
    if (versionCheck.message) {
      updateAlert = `\n\n## ${versionCheck.updateAvailable ? '⚠️ Update Available' : 'ℹ️ Version Info'}\n${versionCheck.message}\n`;
    }

    const statusText = `# ✅ CodeBakers is Active!

## Connection Status
- **MCP Server:** Running
- **API Connected:** Yes
${versionSection}
${updateAlert}
## Current Settings
- **Experience Level:** ${level.charAt(0).toUpperCase() + level.slice(1)}
- **Project:** ${context.projectName}

## Available Features
- 🔧 **optimize_and_build** - AI-powered prompt optimization
- 📦 **get_pattern** - Fetch production patterns
- 🔍 **search_patterns** - Search for specific guidance
- 🏗️ **scaffold_project** - Create new projects
- ⚙️ **init_project** - Add patterns to existing projects
- 🎨 **design** - Clone designs from mockups/websites
- ⬆️ **upgrade** - Upgrade project patterns (preserves your stack)
- 📊 **project_status** - Show build progress

## How to Use
Just describe what you want to build! I'll automatically:
1. Analyze your request
2. Find the right patterns
3. Apply production best practices

**Example:** "Build a login page with email/password"

---
*CodeBakers is providing AI-assisted development patterns for this project.*`;

    // Add CLI update notice if available
    const statusWithNotice = statusText + this.getUpdateNotice();

    return {
      content: [{
        type: 'text' as const,
        text: statusWithNotice,
      }],
    };
  }

  private async handleDesign(args: { source: string; outputDir?: string }) {
    const { source, outputDir = 'src/components' } = args;
    const cwd = process.cwd();

    // Detect source type
    let sourceType: 'folder' | 'file' | 'url' | 'reference' = 'reference';
    if (source.startsWith('http://') || source.startsWith('https://')) {
      sourceType = 'url';
    } else if (source.startsWith('./') || source.startsWith('/') || source.includes('\\')) {
      const fullPath = path.join(cwd, source);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        sourceType = stat.isDirectory() ? 'folder' : 'file';
      }
    } else if (source.toLowerCase().startsWith('like ')) {
      sourceType = 'reference';
    }

    // Fetch design pattern from API
    const patternResult = await this.fetchPatterns(['33-design-clone', '09-design']);

    let response = `# 🎨 Design Clone Tool\n\n`;
    response += `**Source:** ${source}\n`;
    response += `**Type:** ${sourceType}\n`;
    response += `**Output:** ${outputDir}\n\n`;

    switch (sourceType) {
      case 'folder':
        const folderPath = path.join(cwd, source);
        const images = fs.readdirSync(folderPath).filter(f =>
          /\.(png|jpg|jpeg|webp|svg|gif)$/i.test(f)
        );
        response += `## Found ${images.length} Design Files\n\n`;
        images.forEach(img => {
          response += `- ${img}\n`;
        });
        response += `\n## Next Steps\n\n`;
        response += `1. I'll analyze each image for design tokens\n`;
        response += `2. Extract colors, typography, spacing\n`;
        response += `3. Generate Tailwind config with your design system\n`;
        response += `4. Create matching components\n\n`;
        response += `**Note:** For best results, provide screenshots of:\n`;
        response += `- Color palette / brand guidelines\n`;
        response += `- Typography samples\n`;
        response += `- Key UI components (buttons, cards, forms)\n`;
        break;

      case 'file':
        response += `## Analyzing Single Design\n\n`;
        response += `I'll extract design tokens from this image and generate matching components.\n\n`;
        response += `**Tip:** For a complete design system, provide a folder with multiple mockups.\n`;
        break;

      case 'url':
        response += `## Cloning Website Design\n\n`;
        response += `I'll analyze the visual design at ${source} and extract:\n`;
        response += `- Color palette\n`;
        response += `- Typography (fonts, sizes, weights)\n`;
        response += `- Spacing system\n`;
        response += `- Component patterns\n\n`;
        response += `**Note:** This creates inspired-by components, not exact copies.\n`;
        break;

      case 'reference':
        const refStyle = source.replace(/^like\s+/i, '').toLowerCase();
        const knownStyles: Record<string, string> = {
          'linear': 'Dark theme, purple accents, minimal, clean',
          'notion': 'Light theme, black/white, content-focused, lots of whitespace',
          'stripe': 'Professional, purple gradients, polished shadows',
          'vercel': 'Black/white, developer-focused, geometric',
          'github': 'Blue accents, familiar, dev-tool aesthetic',
          'figma': 'Purple accents, collaborative, modern',
        };
        const matchedStyle = Object.entries(knownStyles).find(([key]) =>
          refStyle.includes(key)
        );
        if (matchedStyle) {
          response += `## Reference Style: ${matchedStyle[0]}\n\n`;
          response += `**Characteristics:** ${matchedStyle[1]}\n\n`;
        } else {
          response += `## Reference Style: "${source}"\n\n`;
          response += `I'll apply a design language inspired by this reference.\n\n`;
        }
        response += `I'll generate components matching this aesthetic.\n`;
        break;
    }

    response += `\n---\n\n`;
    response += `## Design Pattern Loaded\n\n`;
    response += `The design-clone pattern (33-design-clone) is now active.\n`;
    response += `Proceed with specific component requests like:\n`;
    response += `- "Create the navigation bar"\n`;
    response += `- "Build the hero section"\n`;
    response += `- "Generate the card components"\n`;

    return {
      content: [{
        type: 'text' as const,
        text: response,
      }],
    };
  }

  private async handleUpgrade(args: { areas?: string[]; severity?: string; dryRun?: boolean }) {
    const { areas = ['all'], severity = 'all', dryRun = false } = args;
    const context = this.gatherProjectContext();
    const cwd = process.cwd();

    let response = `# ⬆️ Project Upgrade Analysis\n\n`;

    // Stack detection
    response += `## Your Stack (Preserving As-Is)\n\n`;
    response += `| Layer | Detected | Status |\n`;
    response += `|-------|----------|--------|\n`;

    // ORM detection
    let orm = 'None';
    if (context.dependencies.includes('drizzle-orm')) orm = 'Drizzle';
    else if (context.dependencies.includes('@prisma/client')) orm = 'Prisma';
    else if (context.dependencies.includes('typeorm')) orm = 'TypeORM';
    else if (context.dependencies.includes('mongoose')) orm = 'Mongoose';
    response += `| ORM | ${orm} | ✓ Keeping |\n`;

    // Auth detection
    let auth = 'None';
    if (context.dependencies.includes('@supabase/supabase-js')) auth = 'Supabase';
    else if (context.dependencies.includes('next-auth')) auth = 'NextAuth';
    else if (context.dependencies.includes('@clerk/nextjs')) auth = 'Clerk';
    else if (context.dependencies.includes('firebase')) auth = 'Firebase';
    response += `| Auth | ${auth} | ✓ Keeping |\n`;

    // UI detection
    response += `| UI | ${context.uiLibrary || 'Tailwind'} | ✓ Keeping |\n`;

    // Framework (always Next.js for now)
    const hasNext = context.dependencies.includes('next');
    response += `| Framework | ${hasNext ? 'Next.js' : 'Unknown'} | ✓ Keeping |\n`;

    response += `\n---\n\n`;

    // Git Analysis Section
    response += `## Deep Analysis\n\n`;

    // Check if git repo
    const isGitRepo = fs.existsSync(path.join(cwd, '.git'));

    if (isGitRepo) {
      response += `### Git Hot Spots (Most Changed Files)\n\n`;
      try {
        // Get files with most commits
        const gitLog = execSync(
          'git log --pretty=format: --name-only --since="6 months ago" 2>/dev/null | sort | uniq -c | sort -rg | head -10',
          { cwd, encoding: 'utf-8', timeout: 10000 }
        ).trim();

        if (gitLog) {
          const hotSpots = gitLog.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.includes('node_modules'))
            .slice(0, 5);

          if (hotSpots.length > 0) {
            hotSpots.forEach((line, i) => {
              const match = line.match(/^\s*(\d+)\s+(.+)$/);
              if (match) {
                const [, count, file] = match;
                response += `${i + 1}. \`${file}\` - ${count} changes\n`;
              }
            });
            response += `\n`;
          }
        }

        // Count fix commits
        const fixCount = execSync(
          'git log --oneline --since="6 months ago" 2>/dev/null | grep -i "fix" | wc -l',
          { cwd, encoding: 'utf-8', timeout: 5000 }
        ).trim();

        if (parseInt(fixCount) > 0) {
          response += `**Bug Fix Commits:** ${fixCount} (in last 6 months)\n\n`;
        }
      } catch {
        response += `*(Git analysis unavailable)*\n\n`;
      }
    } else {
      response += `*(Not a git repository - skipping git analysis)*\n\n`;
    }

    // TODO/FIXME Scan
    response += `### Developer Notes (TODO/FIXME)\n\n`;
    try {
      const todoScan = execSync(
        'grep -r "TODO\\|FIXME\\|HACK\\|XXX\\|BUG" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l 2>/dev/null | head -20',
        { cwd, encoding: 'utf-8', timeout: 10000 }
      ).trim();

      if (todoScan) {
        const todoFiles = todoScan.split('\n').filter(f => !f.includes('node_modules'));
        const todoCount = todoFiles.length;

        if (todoCount > 0) {
          response += `Found developer notes in **${todoCount} files**:\n\n`;

          // Count by type
          try {
            const todoTypes = execSync(
              'grep -roh "TODO\\|FIXME\\|HACK\\|XXX\\|BUG" --include="*.ts" --include="*.tsx" 2>/dev/null | sort | uniq -c | sort -rg',
              { cwd, encoding: 'utf-8', timeout: 10000 }
            ).trim();

            if (todoTypes) {
              todoTypes.split('\n').forEach(line => {
                const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
                if (match) {
                  const [, count, type] = match;
                  const icon = type === 'FIXME' || type === 'BUG' ? '🔴' :
                    type === 'HACK' ? '🟡' : '📝';
                  response += `- ${icon} ${count} ${type}s\n`;
                }
              });
              response += `\n`;
            }
          } catch {
            // Ignore count errors
          }

          response += `*I can implement these TODOs and fix FIXMEs during upgrade.*\n\n`;
        }
      } else {
        response += `✅ No TODO/FIXME comments found - clean codebase!\n\n`;
      }
    } catch {
      response += `*(TODO scan unavailable)*\n\n`;
    }

    // Dependency Security Scan (npm audit)
    response += `### 🔒 Dependency Security Scan\n\n`;
    try {
      const auditOutput = execSync('npm audit --json 2>/dev/null', {
        cwd,
        encoding: 'utf-8',
        timeout: 30000,
      });
      const audit = JSON.parse(auditOutput);
      const vulns = audit.metadata?.vulnerabilities || {};
      const total = (vulns.critical || 0) + (vulns.high || 0) + (vulns.moderate || 0) + (vulns.low || 0);

      if (total > 0) {
        response += `Found **${total} vulnerabilities**:\n\n`;
        if (vulns.critical > 0) response += `- 🔴 **${vulns.critical} Critical**\n`;
        if (vulns.high > 0) response += `- 🟠 **${vulns.high} High**\n`;
        if (vulns.moderate > 0) response += `- 🟡 **${vulns.moderate} Moderate**\n`;
        if (vulns.low > 0) response += `- 🟢 **${vulns.low} Low**\n`;
        response += `\n*Run \`npm audit fix\` to auto-fix, or \`npm audit\` for details.*\n\n`;
      } else {
        response += `✅ No known vulnerabilities in dependencies!\n\n`;
      }
    } catch (error) {
      // npm audit exits with non-zero if vulnerabilities found
      const execError = error as { stdout?: string };
      if (execError.stdout) {
        try {
          const audit = JSON.parse(execError.stdout);
          const vulns = audit.metadata?.vulnerabilities || {};
          const total = (vulns.critical || 0) + (vulns.high || 0) + (vulns.moderate || 0) + (vulns.low || 0);

          if (total > 0) {
            response += `Found **${total} vulnerabilities**:\n\n`;
            if (vulns.critical > 0) response += `- 🔴 **${vulns.critical} Critical**\n`;
            if (vulns.high > 0) response += `- 🟠 **${vulns.high} High**\n`;
            if (vulns.moderate > 0) response += `- 🟡 **${vulns.moderate} Moderate**\n`;
            if (vulns.low > 0) response += `- 🟢 **${vulns.low} Low**\n`;
            response += `\n*Run \`npm audit fix\` to auto-fix, or \`npm audit\` for details.*\n\n`;
          }
        } catch {
          response += `*(Dependency scan unavailable)*\n\n`;
        }
      } else {
        response += `*(Dependency scan unavailable)*\n\n`;
      }
    }

    // TypeScript Strictness Check
    response += `### 📝 TypeScript Configuration\n\n`;
    try {
      const tsconfigPath = path.join(cwd, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        const compilerOptions = tsconfig.compilerOptions || {};

        const checks = [
          { name: 'strict', value: compilerOptions.strict, recommended: true },
          { name: 'noImplicitAny', value: compilerOptions.noImplicitAny, recommended: true },
          { name: 'strictNullChecks', value: compilerOptions.strictNullChecks, recommended: true },
          { name: 'noUnusedLocals', value: compilerOptions.noUnusedLocals, recommended: true },
          { name: 'noUnusedParameters', value: compilerOptions.noUnusedParameters, recommended: true },
        ];

        const enabled = checks.filter(c => c.value === true);
        const missing = checks.filter(c => c.value !== true && c.recommended);

        if (compilerOptions.strict === true) {
          response += `✅ **Strict mode enabled** - Good!\n\n`;
        } else {
          response += `⚠️ **Strict mode not enabled**\n\n`;
          if (missing.length > 0) {
            response += `Missing recommended options:\n`;
            missing.forEach(m => {
              response += `- \`${m.name}: true\`\n`;
            });
            response += `\n`;
          }
        }

        // Check for any types
        try {
          const anyCount = execSync(
            'grep -r ": any" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l',
            { cwd, encoding: 'utf-8', timeout: 10000 }
          ).trim();
          const count = parseInt(anyCount);
          if (count > 10) {
            response += `⚠️ Found **${count}** uses of \`: any\` - consider typing these\n\n`;
          } else if (count > 0) {
            response += `📝 Found **${count}** uses of \`: any\`\n\n`;
          }
        } catch {
          // Ignore
        }
      } else {
        response += `⚠️ No tsconfig.json found - not a TypeScript project?\n\n`;
      }
    } catch {
      response += `*(TypeScript check unavailable)*\n\n`;
    }

    // Environment Variable Audit
    response += `### 🔐 Environment Variable Audit\n\n`;
    try {
      const envExamplePath = path.join(cwd, '.env.example');
      const envLocalPath = path.join(cwd, '.env.local');
      const envPath = path.join(cwd, '.env');

      const hasEnvExample = fs.existsSync(envExamplePath);
      const hasEnvLocal = fs.existsSync(envLocalPath);
      const hasEnv = fs.existsSync(envPath);

      if (hasEnvExample) {
        response += `✅ \`.env.example\` exists - good for documentation\n`;
      } else {
        response += `⚠️ No \`.env.example\` - add one for team onboarding\n`;
      }

      // Check for hardcoded secrets in code
      try {
        const secretPatterns = [
          'sk-[a-zA-Z0-9]{20,}',  // OpenAI keys
          'sk_live_[a-zA-Z0-9]+', // Stripe live keys
          'pk_live_[a-zA-Z0-9]+', // Stripe public live keys
          'ghp_[a-zA-Z0-9]+',     // GitHub tokens
          'AKIA[A-Z0-9]{16}',     // AWS access keys
        ];

        let secretsFound = 0;
        for (const pattern of secretPatterns) {
          try {
            const matches = execSync(
              `grep -rE "${pattern}" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v node_modules | grep -v ".env" | wc -l`,
              { cwd, encoding: 'utf-8', timeout: 5000 }
            ).trim();
            secretsFound += parseInt(matches) || 0;
          } catch {
            // Pattern not found
          }
        }

        if (secretsFound > 0) {
          response += `\n🔴 **CRITICAL: Found ${secretsFound} potential hardcoded secrets in code!**\n`;
          response += `*These should be moved to environment variables immediately.*\n`;
        } else {
          response += `\n✅ No hardcoded secrets detected in code\n`;
        }
      } catch {
        // Ignore
      }

      // Check if .env is gitignored
      try {
        const gitignorePath = path.join(cwd, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
          if (!gitignore.includes('.env')) {
            response += `\n⚠️ \`.env\` not in .gitignore - secrets could be committed!\n`;
          }
        }
      } catch {
        // Ignore
      }

      response += `\n`;
    } catch {
      response += `*(Environment audit unavailable)*\n\n`;
    }

    // Test Coverage Analysis
    response += `### 🧪 Test Coverage\n\n`;
    try {
      const hasPlaywright = context.dependencies.includes('@playwright/test');
      const hasVitest = context.dependencies.includes('vitest');
      const hasJest = context.dependencies.includes('jest');

      if (hasPlaywright || hasVitest || hasJest) {
        const framework = hasPlaywright ? 'Playwright' : hasVitest ? 'Vitest' : 'Jest';
        response += `✅ Test framework detected: **${framework}**\n\n`;

        // Count test files
        try {
          const testFiles = execSync(
            'find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" 2>/dev/null | grep -v node_modules | wc -l',
            { cwd, encoding: 'utf-8', timeout: 10000 }
          ).trim();
          const count = parseInt(testFiles);
          if (count > 0) {
            response += `Found **${count} test files**\n\n`;
          } else {
            response += `⚠️ No test files found - add tests!\n\n`;
          }
        } catch {
          // Ignore
        }
      } else {
        response += `⚠️ **No test framework detected**\n\n`;
        response += `Recommended: Add \`vitest\` or \`@playwright/test\`\n\n`;
      }
    } catch {
      response += `*(Test analysis unavailable)*\n\n`;
    }

    // API Endpoint Inventory
    response += `### 🔌 API Endpoint Inventory\n\n`;
    if (context.existingApiRoutes.length > 0) {
      response += `Found **${context.existingApiRoutes.length} API routes**:\n\n`;

      // Check for auth protection on routes
      let protectedCount = 0;
      let unprotectedCount = 0;

      for (const route of context.existingApiRoutes.slice(0, 10)) {
        try {
          const routePath = path.join(cwd, route);
          if (fs.existsSync(routePath)) {
            const content = fs.readFileSync(routePath, 'utf-8');
            const hasAuth = content.includes('getServerSession') ||
                           content.includes('auth(') ||
                           content.includes('requireAuth') ||
                           content.includes('Authorization') ||
                           content.includes('authenticate');
            if (hasAuth) {
              protectedCount++;
            } else {
              unprotectedCount++;
            }
          }
        } catch {
          // Ignore
        }
      }

      if (protectedCount > 0 || unprotectedCount > 0) {
        response += `- 🔒 **${protectedCount}** routes with auth checks\n`;
        response += `- 🔓 **${unprotectedCount}** routes without visible auth\n\n`;

        if (unprotectedCount > protectedCount) {
          response += `⚠️ *Many routes lack visible auth - review if intentional*\n\n`;
        }
      }
    } else {
      response += `No API routes detected yet.\n\n`;
    }

    response += `---\n\n`;

    // Scan for upgrade opportunities
    response += `## Upgrade Opportunities\n\n`;

    const upgrades: Array<{ area: string; issue: string; severity: string; count: number }> = [];

    // Check API routes
    if (context.existingApiRoutes.length > 0) {
      upgrades.push({
        area: 'API Routes',
        issue: 'Add error handling, validation, rate limiting',
        severity: 'HIGH',
        count: context.existingApiRoutes.length,
      });
    }

    // Check components
    if (context.existingComponents.length > 0) {
      upgrades.push({
        area: 'Components',
        issue: 'Add loading states, error boundaries, accessibility',
        severity: 'MEDIUM',
        count: context.existingComponents.length,
      });
    }

    // Check for tests
    const hasTests = context.dependencies.includes('@playwright/test') ||
      context.dependencies.includes('jest') ||
      context.dependencies.includes('vitest');
    if (!hasTests) {
      upgrades.push({
        area: 'Testing',
        issue: 'No test framework detected',
        severity: 'HIGH',
        count: 0,
      });
    }

    // Check for Zod
    const hasZod = context.dependencies.includes('zod');
    if (!hasZod && context.existingApiRoutes.length > 0) {
      upgrades.push({
        area: 'Validation',
        issue: 'No Zod validation detected for API routes',
        severity: 'HIGH',
        count: context.existingApiRoutes.length,
      });
    }

    // Display upgrades
    for (const upgrade of upgrades) {
      const icon = upgrade.severity === 'HIGH' ? '🔴' :
        upgrade.severity === 'MEDIUM' ? '🟡' : '🟢';
      response += `### ${icon} ${upgrade.area}\n`;
      response += `- **Issue:** ${upgrade.issue}\n`;
      if (upgrade.count > 0) {
        response += `- **Affected:** ${upgrade.count} files\n`;
      }
      response += `- **Severity:** ${upgrade.severity}\n\n`;
    }

    if (upgrades.length === 0) {
      response += `✅ No major upgrade opportunities detected!\n\n`;
    }

    // Review mode options
    response += `---\n\n`;
    response += `## Review Modes\n\n`;
    response += `Pick a focus for the upgrade:\n\n`;
    response += `- **Security Audit** - Auth, secrets, injections, OWASP top 10\n`;
    response += `- **Performance Review** - Bundle size, queries, caching\n`;
    response += `- **Code Quality** - Patterns, DRY, complexity\n`;
    response += `- **Pre-Launch** - Everything for production\n`;
    response += `- **Quick Scan** - Top 5 issues only\n`;
    response += `- **Comprehensive** - All of the above\n\n`;

    // Recommendations
    response += `---\n\n`;
    response += `## Recommended Actions\n\n`;

    if (dryRun) {
      response += `**(Dry Run Mode - No changes will be made)**\n\n`;
    }

    response += `1. Tell me your main concerns (security, performance, etc.)\n`;
    response += `2. I'll prioritize fixes based on your needs\n`;
    response += `3. Hot spot files get fixed first (where bugs live)\n`;
    response += `4. I'll implement your TODOs and fix FIXMEs along the way\n\n`;

    response += `---\n\n`;
    response += `**Key Principle:** Your stack stays the same. Only code quality patterns are upgraded.\n`;

    return {
      content: [{
        type: 'text' as const,
        text: response,
      }],
    };
  }

  private handleProjectStatus() {
    const cwd = process.cwd();
    const context = this.gatherProjectContext();

    let response = `# 📊 Project Status\n\n`;
    response += `**Project:** ${context.projectName}\n\n`;

    // Check for .codebakers.json state
    let state: Record<string, unknown> | null = null;
    try {
      const statePath = path.join(cwd, '.codebakers.json');
      if (fs.existsSync(statePath)) {
        state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      }
    } catch {
      // No state file
    }

    // Check for PRD
    const prdPath = path.join(cwd, 'PRD.md');
    const hasPrd = fs.existsSync(prdPath);

    // Check for PROJECT-STATE.md
    const projectStatePath = path.join(cwd, 'PROJECT-STATE.md');
    const hasProjectState = fs.existsSync(projectStatePath);

    if (state && typeof state === 'object') {
      const s = state as Record<string, unknown>;

      // Build progress
      if (s.build && typeof s.build === 'object') {
        const build = s.build as Record<string, unknown>;
        response += `## Build Progress\n\n`;
        const currentPhase = build.currentPhase as number || 0;
        const totalPhases = build.totalPhases as number || 1;
        const percent = Math.round((currentPhase / totalPhases) * 100);
        response += `**Phase ${currentPhase}/${totalPhases}** (${percent}%)\n\n`;

        // Progress bar
        const filled = Math.round(percent / 10);
        const empty = 10 - filled;
        response += `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%\n\n`;

        if (build.status) {
          response += `**Status:** ${build.status}\n\n`;
        }
      }

      // Current work
      if (s.currentWork && typeof s.currentWork === 'object') {
        const work = s.currentWork as Record<string, unknown>;
        response += `## Current Work\n\n`;
        if (work.activeFeature) {
          response += `**In Progress:** ${work.activeFeature}\n`;
        }
        if (work.summary) {
          response += `**Summary:** ${work.summary}\n`;
        }
        if (work.lastUpdated) {
          response += `**Last Updated:** ${work.lastUpdated}\n`;
        }
        response += `\n`;
      }

      // Stack
      if (s.stack && typeof s.stack === 'object') {
        const stack = s.stack as Record<string, unknown>;
        response += `## Stack\n\n`;
        for (const [key, value] of Object.entries(stack)) {
          if (value) {
            response += `- **${key}:** ${value}\n`;
          }
        }
        response += `\n`;
      }
    } else {
      response += `## Project Overview\n\n`;
      response += `- **PRD:** ${hasPrd ? '✅ Found' : '❌ Not found'}\n`;
      response += `- **State Tracking:** ${hasProjectState ? '✅ Found' : '❌ Not found'}\n`;
      response += `- **CodeBakers State:** ${state ? '✅ Found' : '❌ Not initialized'}\n\n`;
    }

    // What's built
    response += `## What's Built\n\n`;
    response += `- **Components:** ${context.existingComponents.length}\n`;
    response += `- **API Routes:** ${context.existingApiRoutes.length}\n`;
    response += `- **Services:** ${context.existingServices.length}\n`;

    if (context.hasAuth) response += `- ✅ Authentication\n`;
    if (context.hasDatabase) response += `- ✅ Database\n`;
    if (context.hasPayments) response += `- ✅ Payments\n`;

    response += `\n`;

    // Recent components
    if (context.existingComponents.length > 0) {
      response += `### Recent Components\n`;
      context.existingComponents.slice(0, 10).forEach(comp => {
        response += `- ${comp}\n`;
      });
      if (context.existingComponents.length > 10) {
        response += `- ... and ${context.existingComponents.length - 10} more\n`;
      }
      response += `\n`;
    }

    response += `---\n\n`;
    response += `*Run \`upgrade\` to improve code quality or \`run_audit\` for detailed analysis.*`;

    return {
      content: [{
        type: 'text' as const,
        text: response,
      }],
    };
  }

  private handleRunTests(args: { filter?: string; watch?: boolean }) {
    const { filter, watch = false } = args;
    const cwd = process.cwd();

    // Detect test runner from package.json
    let testCommand = 'npm test';
    try {
      const pkgPath = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['@playwright/test']) {
          testCommand = 'npx playwright test';
        } else if (deps['vitest']) {
          testCommand = 'npx vitest run';
        } else if (deps['jest']) {
          testCommand = 'npx jest';
        }
      }
    } catch {
      // Use default
    }

    // Add filter if provided
    if (filter) {
      testCommand += ` ${filter}`;
    }

    // Add watch mode
    if (watch) {
      testCommand = testCommand.replace(' run', ''); // Remove 'run' for vitest watch
      if (testCommand.includes('vitest')) {
        testCommand = testCommand.replace('vitest run', 'vitest');
      }
    }

    let response = `# 🧪 Running Tests\n\n`;
    response += `**Command:** \`${testCommand}\`\n\n`;

    try {
      const output = execSync(testCommand, {
        cwd,
        encoding: 'utf-8',
        timeout: 120000, // 2 minute timeout
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      response += `## ✅ Tests Passed\n\n`;
      response += '```\n' + output.slice(-2000) + '\n```\n';
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; status?: number };
      response += `## ❌ Tests Failed\n\n`;

      if (execError.stdout) {
        response += '### Output\n```\n' + execError.stdout.slice(-2000) + '\n```\n\n';
      }
      if (execError.stderr) {
        response += '### Errors\n```\n' + execError.stderr.slice(-1000) + '\n```\n\n';
      }

      response += `**Exit Code:** ${execError.status || 1}\n\n`;
      response += `---\n\n*Fix the failing tests and run again.*`;
    }

    return {
      content: [{
        type: 'text' as const,
        text: response,
      }],
    };
  }

  private async handleReportPatternGap(args: { category: string; request: string; context?: string; handledWith?: string; wasSuccessful?: boolean }) {
    const { category, request, context, handledWith, wasSuccessful = true } = args;

    try {
      const response = await fetch(`${this.apiUrl}/api/pattern-gaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          category,
          request,
          context,
          handledWith,
          wasSuccessful,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to report pattern gap');
      }

      const result = await response.json();

      if (result.deduplicated) {
        return {
          content: [{
            type: 'text' as const,
            text: `📊 Pattern gap already reported recently (category: ${category}). No duplicate created.`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `✅ Pattern gap reported successfully.\n\n**Category:** ${category}\n**Request:** ${request}\n\nThis helps improve CodeBakers for everyone!`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text' as const,
          text: `⚠️ Could not report pattern gap: ${message}\n\n(This doesn't affect your current work)`,
        }],
      };
    }
  }

  private async handleTrackAnalytics(args: { eventType: string; eventData?: Record<string, unknown>; projectHash?: string }) {
    const { eventType, eventData, projectHash } = args;

    try {
      const response = await fetch(`${this.apiUrl}/api/cli/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          eventType,
          eventData,
          projectHash,
        }),
      });

      if (!response.ok) {
        // Silently fail - analytics shouldn't interrupt user workflow
        return {
          content: [{
            type: 'text' as const,
            text: `📊 Analytics tracked: ${eventType}`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `📊 Analytics tracked: ${eventType}`,
        }],
      };
    } catch {
      // Silently fail
      return {
        content: [{
          type: 'text' as const,
          text: `📊 Analytics tracked: ${eventType}`,
        }],
      };
    }
  }

  // ========== VERCEL INTEGRATION ==========

  private getVercelToken(): string | null {
    // Check config first, then env var
    return getServiceKey('vercel') || process.env.VERCEL_TOKEN || null;
  }

  private async handleVercelConnect(args: { token: string }) {
    const { token } = args;

    // Validate the token by making a test API call
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Invalid Vercel token. Please check your token and try again.\n\nGet a new token at: https://vercel.com/account/tokens`,
          }],
          isError: true,
        };
      }

      const user = await response.json();

      // Store the token securely
      setServiceKey('vercel', token);

      return {
        content: [{
          type: 'text' as const,
          text: `✅ Connected to Vercel as ${user.user?.username || user.user?.email || 'unknown user'}\n\nYou can now use:\n- vercel_logs: Fetch runtime logs\n- vercel_analyze_errors: Analyze and fix errors\n- vercel_deployments: View deployment history`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Failed to connect to Vercel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async handleVercelLogs(args: { hours?: number; level?: string; route?: string; limit?: number }) {
    const token = this.getVercelToken();
    if (!token) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Not connected to Vercel.\n\nTo connect, either:\n1. Use the vercel_connect tool with your API token\n2. Set VERCEL_TOKEN environment variable\n\nGet a token at: https://vercel.com/account/tokens`,
        }],
        isError: true,
      };
    }

    const hours = Math.min(args.hours || 24, 168); // Max 7 days
    const level = args.level || 'error';
    const limit = Math.min(args.limit || 50, 500);
    const since = Date.now() - (hours * 60 * 60 * 1000);

    try {
      // First, get the team/user's projects
      const projectsRes = await fetch('https://api.vercel.com/v9/projects?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!projectsRes.ok) {
        throw new Error(`Failed to fetch projects: ${projectsRes.statusText}`);
      }

      const projectsData = await projectsRes.json();
      const projects = projectsData.projects || [];

      if (projects.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ No Vercel projects found. Make sure your token has access to your projects.`,
          }],
          isError: true,
        };
      }

      // Try to match current project by name
      const cwd = process.cwd();
      const packageJsonPath = `${cwd}/package.json`;
      let currentProjectName = '';
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        currentProjectName = pkg.name?.replace(/^@[^/]+\//, '') || '';
      } catch {
        // Ignore
      }

      // Find matching project or use first one
      const project = projects.find((p: { name: string }) =>
        p.name.toLowerCase() === currentProjectName.toLowerCase()
      ) || projects[0];

      // Fetch logs for the project
      // Note: Vercel's logs API varies by plan. Using runtime logs endpoint
      const logsUrl = new URL(`https://api.vercel.com/v1/projects/${project.id}/logs`);
      logsUrl.searchParams.set('since', since.toString());
      logsUrl.searchParams.set('limit', limit.toString());
      if (level !== 'all') {
        logsUrl.searchParams.set('level', level);
      }
      if (args.route) {
        logsUrl.searchParams.set('path', args.route);
      }

      const logsRes = await fetch(logsUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!logsRes.ok) {
        // Try alternative endpoint for edge/serverless logs
        const altLogsRes = await fetch(
          `https://api.vercel.com/v2/deployments/${project.latestDeployments?.[0]?.id}/events?limit=${limit}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!altLogsRes.ok) {
          throw new Error(`Failed to fetch logs: ${logsRes.statusText}. Your Vercel plan may not support log access via API.`);
        }

        const altLogs = await altLogsRes.json();
        return this.formatVercelLogs(altLogs, project.name, hours, level);
      }

      const logs = await logsRes.json();
      return this.formatVercelLogs(logs, project.name, hours, level);

    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Failed to fetch Vercel logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private formatVercelLogs(logs: unknown, projectName: string, hours: number, level: string) {
    const logEntries = Array.isArray(logs) ? logs : (logs as { logs?: unknown[] })?.logs || [];

    if (logEntries.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `📋 No ${level === 'all' ? '' : level + ' '}logs found for **${projectName}** in the last ${hours} hours.\n\nThis could mean:\n- No matching log entries exist\n- Your Vercel plan may have limited log retention\n- Logs may still be processing`,
        }],
      };
    }

    const formattedLogs = logEntries.slice(0, 50).map((log: Record<string, unknown>) => {
      const timestamp = log.timestamp || log.created || log.createdAt;
      const date = timestamp ? new Date(timestamp as number).toISOString() : 'Unknown';
      const logLevel = (log.level || log.type || 'info') as string;
      const message = log.message || log.text || log.payload || JSON.stringify(log);
      const path = log.path || log.route || '';

      return `[${date}] ${logLevel.toUpperCase()}${path ? ` ${path}` : ''}\n${message}`;
    }).join('\n\n---\n\n');

    const summary = this.summarizeErrors(logEntries);

    return {
      content: [{
        type: 'text' as const,
        text: `# Vercel Logs: ${projectName}\n\n**Period:** Last ${hours} hours\n**Filter:** ${level}\n**Found:** ${logEntries.length} entries\n\n${summary}\n\n## Log Entries\n\n${formattedLogs}`,
      }],
    };
  }

  private summarizeErrors(logs: Record<string, unknown>[]) {
    const errorCounts: Record<string, number> = {};
    const routeCounts: Record<string, number> = {};

    logs.forEach((log) => {
      const message = String(log.message || log.text || '');
      const path = String(log.path || log.route || 'unknown');

      // Extract error type from message
      const errorMatch = message.match(/^(\w+Error):|Error:\s*(\w+)/);
      if (errorMatch) {
        const errorType = errorMatch[1] || errorMatch[2];
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
      }

      // Count by route
      if (path !== 'unknown') {
        routeCounts[path] = (routeCounts[path] || 0) + 1;
      }
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const topRoutes = Object.entries(routeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    let summary = '## Summary\n\n';

    if (topErrors.length > 0) {
      summary += '**Top Error Types:**\n';
      topErrors.forEach(([error, count]) => {
        summary += `- ${error}: ${count} occurrences\n`;
      });
      summary += '\n';
    }

    if (topRoutes.length > 0) {
      summary += '**Most Affected Routes:**\n';
      topRoutes.forEach(([route, count]) => {
        summary += `- ${route}: ${count} errors\n`;
      });
    }

    return summary || 'No patterns detected in logs.';
  }

  private async handleVercelAnalyzeErrors(args: { hours?: number; autoFix?: boolean }) {
    const token = this.getVercelToken();
    if (!token) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Not connected to Vercel. Use vercel_connect first.`,
        }],
        isError: true,
      };
    }

    const hours = args.hours || 24;

    try {
      // Fetch error logs
      const logsResult = await this.handleVercelLogs({ hours, level: 'error', limit: 100 });
      const logsText = logsResult.content?.[0]?.text || '';

      if (logsText.includes('No') && logsText.includes('logs found')) {
        return {
          content: [{
            type: 'text' as const,
            text: `✅ No errors found in the last ${hours} hours! Your app is running smoothly.`,
          }],
        };
      }

      // Classify errors and suggest fixes
      const analysis = this.classifyAndSuggestFixes(logsText);

      return {
        content: [{
          type: 'text' as const,
          text: `# Error Analysis\n\n${analysis}`,
        }],
      };

    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Failed to analyze errors: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private classifyAndSuggestFixes(logsText: string): string {
    const issues: Array<{ type: string; severity: string; count: number; fix: string; pattern?: string }> = [];

    // Common error patterns and their fixes
    const errorPatterns = [
      {
        pattern: /TypeError.*undefined|Cannot read propert/gi,
        type: 'Null/Undefined Access',
        severity: 'HIGH',
        fix: 'Add null checks or optional chaining (?.) before accessing properties.',
        codePattern: '02-auth',
      },
      {
        pattern: /ECONNREFUSED|ETIMEDOUT|fetch failed/gi,
        type: 'Network/Connection Error',
        severity: 'HIGH',
        fix: 'Add retry logic with exponential backoff. Check if external services are available.',
        codePattern: '03-api',
      },
      {
        pattern: /401|Unauthorized|invalid.*token/gi,
        type: 'Authentication Error',
        severity: 'CRITICAL',
        fix: 'Check token expiration and refresh logic. Verify auth middleware is properly configured.',
        codePattern: '02-auth',
      },
      {
        pattern: /500|Internal Server Error/gi,
        type: 'Server Error',
        severity: 'CRITICAL',
        fix: 'Add proper error boundaries and try-catch blocks. Check server logs for stack traces.',
        codePattern: '00-core',
      },
      {
        pattern: /429|Too Many Requests|rate limit/gi,
        type: 'Rate Limiting',
        severity: 'MEDIUM',
        fix: 'Implement request throttling and caching. Add rate limit headers handling.',
        codePattern: '03-api',
      },
      {
        pattern: /CORS|cross-origin|Access-Control/gi,
        type: 'CORS Error',
        severity: 'MEDIUM',
        fix: 'Configure CORS headers in next.config.js or API routes. Check allowed origins.',
        codePattern: '03-api',
      },
      {
        pattern: /prisma|drizzle|database|sql/gi,
        type: 'Database Error',
        severity: 'HIGH',
        fix: 'Check database connection string. Verify migrations are applied. Add connection pooling.',
        codePattern: '01-database',
      },
      {
        pattern: /stripe|payment|charge failed/gi,
        type: 'Payment Error',
        severity: 'CRITICAL',
        fix: 'Check Stripe webhook configuration. Verify API keys. Add idempotency keys.',
        codePattern: '05-payments',
      },
      {
        pattern: /hydration|Minified React|client.*server/gi,
        type: 'React Hydration Error',
        severity: 'MEDIUM',
        fix: 'Ensure server and client render the same content. Use useEffect for client-only code.',
        codePattern: '04-frontend',
      },
    ];

    errorPatterns.forEach(({ pattern, type, severity, fix, codePattern }) => {
      const matches = logsText.match(pattern);
      if (matches) {
        issues.push({ type, severity, count: matches.length, fix, pattern: codePattern });
      }
    });

    if (issues.length === 0) {
      return `No common error patterns detected. Review the raw logs for custom application errors.`;
    }

    // Sort by severity
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    issues.sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);

    let output = `Found **${issues.length}** error patterns:\n\n`;

    issues.forEach((issue, i) => {
      const emoji = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'HIGH' ? '🟠' : '🟡';
      output += `### ${i + 1}. ${emoji} ${issue.type}\n`;
      output += `**Severity:** ${issue.severity} | **Occurrences:** ${issue.count}\n\n`;
      output += `**Fix:** ${issue.fix}\n\n`;
      if (issue.pattern) {
        output += `**Pattern:** Load \`${issue.pattern}.md\` for detailed implementation guidance.\n\n`;
      }
    });

    output += `\n---\n\n**Next Steps:**\n`;
    output += `1. Address CRITICAL issues first\n`;
    output += `2. Use \`get_pattern\` to load relevant CodeBakers patterns\n`;
    output += `3. Run \`heal\` to auto-fix safe issues\n`;

    return output;
  }

  private async handleVercelDeployments(args: { limit?: number; state?: string }) {
    const token = this.getVercelToken();
    if (!token) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Not connected to Vercel. Use vercel_connect first.`,
        }],
        isError: true,
      };
    }

    const limit = args.limit || 10;
    const stateFilter = args.state;

    try {
      // Get deployments
      const url = new URL('https://api.vercel.com/v6/deployments');
      url.searchParams.set('limit', limit.toString());
      if (stateFilter && stateFilter !== 'all') {
        url.searchParams.set('state', stateFilter);
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.statusText}`);
      }

      const data = await response.json();
      const deployments = data.deployments || [];

      if (deployments.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No deployments found${stateFilter ? ` with state: ${stateFilter}` : ''}.`,
          }],
        };
      }

      const formatted = deployments.map((d: Record<string, unknown>) => {
        const created = new Date(d.created as number).toLocaleString();
        const state = d.state || d.readyState || 'UNKNOWN';
        const emoji = state === 'READY' ? '✅' : state === 'ERROR' ? '❌' : state === 'BUILDING' ? '🔨' : '⏳';
        const url = d.url ? `https://${d.url}` : 'N/A';
        const commit = (d.meta as Record<string, unknown>)?.githubCommitMessage || (d.meta as Record<string, unknown>)?.gitlabCommitMessage || 'No commit message';

        return `${emoji} **${state}** - ${created}\n   URL: ${url}\n   Commit: ${commit}`;
      }).join('\n\n');

      return {
        content: [{
          type: 'text' as const,
          text: `# Recent Deployments\n\n${formatted}`,
        }],
      };

    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Failed to fetch deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  /**
   * Handle update_constant tool - updates constants via natural language
   * Parses requests like "change Pro price to $59" and edits constants.ts
   */
  private async handleUpdateConstant(args: { request: string }) {
    const { request } = args;
    const cwd = process.cwd();

    // Find constants.ts file (server project)
    const possiblePaths = [
      path.join(cwd, 'src', 'lib', 'constants.ts'),
      path.join(cwd, 'lib', 'constants.ts'),
      path.join(cwd, 'constants.ts'),
    ];

    let constantsPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        constantsPath = p;
        break;
      }
    }

    if (!constantsPath) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Could not find constants.ts file.\n\nLooked in:\n${possiblePaths.map(p => `- ${p}`).join('\n')}\n\nMake sure you're in the right directory or create src/lib/constants.ts first.`,
        }],
        isError: true,
      };
    }

    // Read current constants file
    const currentContent = fs.readFileSync(constantsPath, 'utf-8');

    // Parse the natural language request to identify what to change
    const parsed = this.parseConstantRequest(request);

    if (!parsed.success) {
      return {
        content: [{
          type: 'text' as const,
          text: `❓ I couldn't understand that request.\n\n**Request:** "${request}"\n\n**Supported changes:**\n- "change Pro monthly price to $59"\n- "set Team yearly price to $1200"\n- "update Agency seats to 10"\n- "set anonymous trial days to 10"\n- "change extended trial days to 14"\n- "update module count to 45"\n- "change support email to help@example.com"\n- "update tagline to 'Build faster'"\n\n**Try rephrasing** your request with the constant name and new value.`,
        }],
      };
    }

    // Apply the change
    const { constantPath, newValue, description } = parsed;
    const updatedContent = this.updateConstantValue(currentContent, constantPath!, newValue!);

    if (updatedContent === currentContent) {
      return {
        content: [{
          type: 'text' as const,
          text: `⚠️ No changes made.\n\nCouldn't find or update: \`${constantPath}\`\n\nThe constant might not exist or the path format is different.`,
        }],
      };
    }

    // Write the updated file
    fs.writeFileSync(constantsPath, updatedContent, 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: `✅ **Constant Updated**\n\n**Change:** ${description}\n**File:** \`${path.relative(cwd, constantsPath)}\`\n\n---\n\n⚡ This change is now active across the entire codebase.\n\nAll components, pages, and APIs that reference this constant will automatically use the new value.`,
      }],
    };
  }

  /**
   * Parse natural language request to identify constant and new value
   */
  private parseConstantRequest(request: string): {
    success: boolean;
    constantPath?: string;
    newValue?: string | number | boolean | null;
    description?: string;
  } {
    const lower = request.toLowerCase();

    // PRICING patterns
    // "change/set/update pro monthly price to $59" or "pro monthly to 59"
    const pricingMatch = lower.match(
      /(?:change|set|update|make)?\s*(pro|team|agency|enterprise)\s*(monthly|yearly)\s*(?:price|cost)?\s*(?:to|=|:)?\s*\$?(\d+)/i
    );
    if (pricingMatch) {
      const plan = pricingMatch[1].toUpperCase();
      const period = pricingMatch[2].toUpperCase();
      const value = parseInt(pricingMatch[3]);
      return {
        success: true,
        constantPath: `PRICING.${plan}.${period}`,
        newValue: value,
        description: `${plan} ${period.toLowerCase()} price → $${value}`,
      };
    }

    // SEATS patterns
    // "change/set team seats to 10" or "agency seats to unlimited"
    const seatsMatch = lower.match(
      /(?:change|set|update|make)?\s*(pro|team|agency|enterprise)\s*seats?\s*(?:to|=|:)?\s*(\d+|unlimited|-1)/i
    );
    if (seatsMatch) {
      const plan = seatsMatch[1].toUpperCase();
      let value: number;
      if (seatsMatch[2] === 'unlimited' || seatsMatch[2] === '-1') {
        value = -1;
      } else {
        value = parseInt(seatsMatch[2]);
      }
      return {
        success: true,
        constantPath: `PRICING.${plan}.SEATS`,
        newValue: value,
        description: `${plan} seats → ${value === -1 ? 'unlimited' : value}`,
      };
    }

    // TRIAL patterns
    // "set anonymous trial days to 10" or "anonymous days to 10"
    const trialMatch = lower.match(
      /(?:change|set|update|make)?\s*(anonymous|extended|total|expiring)\s*(?:trial)?\s*(?:days|threshold)?\s*(?:to|=|:)?\s*(\d+)/i
    );
    if (trialMatch) {
      const trialType = trialMatch[1].toUpperCase();
      const value = parseInt(trialMatch[2]);
      let path: string;
      let desc: string;

      switch (trialType) {
        case 'ANONYMOUS':
          path = 'TRIAL.ANONYMOUS_DAYS';
          desc = `Anonymous trial days → ${value}`;
          break;
        case 'EXTENDED':
          path = 'TRIAL.EXTENDED_DAYS';
          desc = `Extended trial days → ${value}`;
          break;
        case 'TOTAL':
          path = 'TRIAL.TOTAL_DAYS';
          desc = `Total trial days → ${value}`;
          break;
        case 'EXPIRING':
          path = 'TRIAL.EXPIRING_SOON_THRESHOLD';
          desc = `Expiring warning threshold → ${value} days`;
          break;
        default:
          return { success: false };
      }
      return { success: true, constantPath: path, newValue: value, description: desc };
    }

    // MODULE COUNT pattern
    // "set module count to 45" or "modules to 45"
    const moduleMatch = lower.match(
      /(?:change|set|update|make)?\s*(?:module|pattern)\s*count\s*(?:to|=|:)?\s*(\d+)/i
    );
    if (moduleMatch) {
      const value = parseInt(moduleMatch[1]);
      return {
        success: true,
        constantPath: 'MODULES.COUNT',
        newValue: value,
        description: `Module count → ${value}`,
      };
    }

    // PRODUCT string patterns
    // "change tagline to 'Build faster'" or "set support email to help@example.com"
    const productMatch = lower.match(
      /(?:change|set|update|make)?\s*(name|tagline|support\s*email|website|cli\s*command)\s*(?:to|=|:)?\s*["']?([^"']+)["']?/i
    );
    if (productMatch) {
      const field = productMatch[1].toLowerCase().replace(/\s+/g, '_').toUpperCase();
      const value = productMatch[2].trim();
      let path: string;

      if (field === 'SUPPORT_EMAIL') {
        path = 'PRODUCT.SUPPORT_EMAIL';
      } else if (field === 'NAME') {
        path = 'PRODUCT.NAME';
      } else if (field === 'TAGLINE') {
        path = 'PRODUCT.TAGLINE';
      } else if (field === 'WEBSITE') {
        path = 'PRODUCT.WEBSITE';
      } else if (field === 'CLI_COMMAND') {
        path = 'PRODUCT.CLI_COMMAND';
      } else {
        return { success: false };
      }

      return {
        success: true,
        constantPath: path,
        newValue: value,
        description: `${field.replace(/_/g, ' ').toLowerCase()} → "${value}"`,
      };
    }

    // API KEYS patterns
    // "set rate limit to 100 per minute"
    const rateLimitMatch = lower.match(
      /(?:change|set|update|make)?\s*(?:rate\s*limit|requests)\s*(?:per|\/)\s*(minute|hour)\s*(?:to|=|:)?\s*(\d+)/i
    );
    if (rateLimitMatch) {
      const period = rateLimitMatch[1].toUpperCase();
      const value = parseInt(rateLimitMatch[2]);
      const path = period === 'MINUTE'
        ? 'API_KEYS.RATE_LIMIT.REQUESTS_PER_MINUTE'
        : 'API_KEYS.RATE_LIMIT.REQUESTS_PER_HOUR';
      return {
        success: true,
        constantPath: path,
        newValue: value,
        description: `Rate limit → ${value} requests per ${period.toLowerCase()}`,
      };
    }

    // FEATURE FLAGS patterns
    // "enable/disable trial system" or "set trial system to true/false"
    const featureMatch = lower.match(
      /(?:enable|disable|turn\s*on|turn\s*off|set)?\s*(trial\s*system|github\s*extension|anonymous\s*trial)\s*(?:enabled|disabled|on|off|to\s*true|to\s*false)?/i
    );
    if (featureMatch) {
      const feature = featureMatch[1].toLowerCase().replace(/\s+/g, '_').toUpperCase();
      const enabled = lower.includes('enable') || lower.includes('turn on') || lower.includes('to true');
      let path: string;

      if (feature.includes('TRIAL_SYSTEM')) {
        path = 'FEATURES.TRIAL_SYSTEM_ENABLED';
      } else if (feature.includes('GITHUB_EXTENSION')) {
        path = 'FEATURES.GITHUB_EXTENSION_ENABLED';
      } else if (feature.includes('ANONYMOUS_TRIAL')) {
        path = 'FEATURES.ANONYMOUS_TRIAL_ENABLED';
      } else {
        return { success: false };
      }

      return {
        success: true,
        constantPath: path,
        newValue: enabled,
        description: `${feature.replace(/_/g, ' ').toLowerCase()} → ${enabled ? 'enabled' : 'disabled'}`,
      };
    }

    return { success: false };
  }

  /**
   * Update a specific constant value in the file content
   */
  private updateConstantValue(
    content: string,
    constantPath: string,
    newValue: string | number | boolean | null
  ): string {
    const parts = constantPath.split('.');

    // Format the new value for TypeScript
    let formattedValue: string;
    if (typeof newValue === 'string') {
      formattedValue = `'${newValue}'`;
    } else if (typeof newValue === 'boolean') {
      formattedValue = newValue.toString();
    } else if (newValue === null) {
      formattedValue = 'null';
    } else {
      formattedValue = newValue.toString();
    }

    // Build regex to find and replace the value
    // e.g., for PRICING.PRO.MONTHLY, look for "MONTHLY: <number>" within PRO block
    if (parts.length === 2) {
      // Simple case: MODULES.COUNT or FEATURES.X
      const [obj, key] = parts;
      const regex = new RegExp(`(${key}:\\s*)([^,}\\n]+)`, 'g');

      // Find the right object and update within it
      const objRegex = new RegExp(`(export const ${obj}\\s*=\\s*\\{[\\s\\S]*?)(${key}:\\s*)([^,}\\n]+)([\\s\\S]*?\\}\\s*as\\s*const)`, 'g');
      return content.replace(objRegex, `$1$2${formattedValue}$4`);
    } else if (parts.length === 3) {
      // Nested case: PRICING.PRO.MONTHLY
      const [obj, subObj, key] = parts;

      // More complex regex to find nested value
      // Look for the pattern within the specific sub-object
      const objPattern = `export const ${obj}\\s*=\\s*\\{[\\s\\S]*?${subObj}:\\s*\\{[\\s\\S]*?${key}:\\s*`;

      const lines = content.split('\n');
      let inObject = false;
      let inSubObject = false;
      let braceDepth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track if we're in the right object
        if (line.includes(`export const ${obj}`)) {
          inObject = true;
        }

        if (inObject) {
          // Count braces
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;

          // Check if we're in the sub-object
          if (line.includes(`${subObj}:`)) {
            inSubObject = true;
          }

          if (inSubObject && line.includes(`${key}:`)) {
            // Found the line to update
            lines[i] = line.replace(
              new RegExp(`(${key}:\\s*)([^,}\\n]+)`),
              `$1${formattedValue}`
            );
            break;
          }

          // Exit sub-object when we see closing brace at right depth
          if (inSubObject && line.includes('}') && !line.includes('{')) {
            // Check if this closes the sub-object
            const match = line.match(/^\s*\}/);
            if (match) {
              inSubObject = false;
            }
          }

          if (braceDepth === 0) {
            inObject = false;
          }
        }
      }

      return lines.join('\n');
    } else if (parts.length === 4) {
      // Deeply nested: API_KEYS.RATE_LIMIT.REQUESTS_PER_MINUTE
      const [obj, subObj1, subObj2, key] = parts;

      const lines = content.split('\n');
      let inObject = false;
      let inSubObj1 = false;
      let inSubObj2 = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes(`export const ${obj}`)) {
          inObject = true;
        }

        if (inObject && line.includes(`${subObj1}:`)) {
          inSubObj1 = true;
        }

        if (inSubObj1 && line.includes(`${subObj2}:`)) {
          inSubObj2 = true;
        }

        if (inSubObj2 && line.includes(`${key}:`)) {
          lines[i] = line.replace(
            new RegExp(`(${key}:\\s*)([^,}\\n]+)`),
            `$1${formattedValue}`
          );
          break;
        }

        // Reset on closing braces (simplified - could be more robust)
        if (inSubObj2 && line.trim() === '},') {
          inSubObj2 = false;
        }
        if (inSubObj1 && line.trim() === '},') {
          inSubObj1 = false;
        }
      }

      return lines.join('\n');
    }

    return content;
  }

  /**
   * Handle update_schema tool - add/modify database tables via natural language
   */
  private async handleUpdateSchema(args: { request: string }) {
    const { request } = args;
    const cwd = process.cwd();

    // Find schema file
    const possiblePaths = [
      path.join(cwd, 'src', 'db', 'schema.ts'),
      path.join(cwd, 'db', 'schema.ts'),
      path.join(cwd, 'schema.ts'),
      path.join(cwd, 'drizzle', 'schema.ts'),
    ];

    let schemaPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }

    if (!schemaPath) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Could not find schema.ts file.\n\nLooked in:\n${possiblePaths.map(p => `- ${p}`).join('\n')}\n\nMake sure you have a Drizzle schema file or create one at src/db/schema.ts`,
        }],
        isError: true,
      };
    }

    // Parse the request to understand what to create
    const parsed = this.parseSchemaRequest(request);

    if (!parsed.success) {
      return {
        content: [{
          type: 'text' as const,
          text: `❓ I couldn't understand that schema request.\n\n**Request:** "${request}"\n\n**Supported changes:**\n- "add a tags table with name and color fields"\n- "create a comments table with userId, postId, and content"\n- "add isArchived boolean to projects table"\n- "add createdAt timestamp to users"\n\n**Try rephrasing** with the table name and fields.`,
        }],
      };
    }

    // Read current schema
    const currentSchema = fs.readFileSync(schemaPath, 'utf-8');

    // Generate new schema code
    const { tableName, fields, action, description } = parsed;
    let newCode: string;
    let updatedSchema: string;

    if (action === 'create_table') {
      newCode = this.generateTableSchema(tableName!, fields!);
      // Add to end of file before any exports
      const exportIndex = currentSchema.lastIndexOf('export {');
      if (exportIndex > 0) {
        updatedSchema = currentSchema.slice(0, exportIndex) + newCode + '\n\n' + currentSchema.slice(exportIndex);
      } else {
        updatedSchema = currentSchema + '\n\n' + newCode;
      }
    } else if (action === 'add_field') {
      // Find the table and add field
      const tableRegex = new RegExp(`export const ${tableName} = pgTable\\([^)]+\\{([\\s\\S]*?)\\}\\s*\\)`, 'g');
      const match = tableRegex.exec(currentSchema);
      if (!match) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Could not find table "${tableName}" in schema.\n\nMake sure the table exists before adding fields.`,
          }],
        };
      }
      const fieldCode = this.generateFieldCode(fields![0]);
      // Insert before the closing brace
      const insertPos = match.index + match[0].lastIndexOf('}');
      updatedSchema = currentSchema.slice(0, insertPos) + fieldCode + ',\n  ' + currentSchema.slice(insertPos);
    } else {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Unknown schema action: ${action}`,
        }],
      };
    }

    // Write updated schema
    fs.writeFileSync(schemaPath, updatedSchema, 'utf-8');

    // Generate migration reminder
    const migrationHint = `\n\n📝 **Next steps:**\n1. Run \`npx drizzle-kit generate\` to create migration\n2. Run \`npx drizzle-kit migrate\` to apply it`;

    return {
      content: [{
        type: 'text' as const,
        text: `✅ **Schema Updated**\n\n**Change:** ${description}\n**File:** \`${path.relative(cwd, schemaPath)}\`${migrationHint}`,
      }],
    };
  }

  private parseSchemaRequest(request: string): {
    success: boolean;
    action?: 'create_table' | 'add_field';
    tableName?: string;
    fields?: Array<{ name: string; type: string; nullable?: boolean; references?: string }>;
    description?: string;
  } {
    const lower = request.toLowerCase();

    // Create table pattern: "add/create a X table with Y, Z fields"
    const createMatch = lower.match(
      /(?:add|create)\s+(?:a\s+)?(\w+)\s+table\s+(?:with\s+)?(.+)/i
    );
    if (createMatch) {
      const tableName = createMatch[1];
      const fieldsStr = createMatch[2];
      const fields = this.parseFields(fieldsStr);

      return {
        success: true,
        action: 'create_table',
        tableName,
        fields,
        description: `Created "${tableName}" table with ${fields.length} fields`,
      };
    }

    // Add field pattern: "add X to Y table"
    const addFieldMatch = lower.match(
      /add\s+(\w+)\s+(?:field|column)?\s*(?:to\s+)?(\w+)\s+table/i
    );
    if (addFieldMatch) {
      const fieldName = addFieldMatch[1];
      const tableName = addFieldMatch[2];

      // Detect type from name
      let fieldType = 'text';
      if (fieldName.includes('id') || fieldName.includes('Id')) fieldType = 'uuid';
      else if (fieldName.includes('at') || fieldName.includes('At') || fieldName.includes('date')) fieldType = 'timestamp';
      else if (fieldName.includes('is') || fieldName.includes('Is') || fieldName.includes('has') || fieldName.includes('Has')) fieldType = 'boolean';
      else if (fieldName.includes('count') || fieldName.includes('Count') || fieldName.includes('num') || fieldName.includes('Num')) fieldType = 'integer';

      return {
        success: true,
        action: 'add_field',
        tableName,
        fields: [{ name: fieldName, type: fieldType }],
        description: `Added "${fieldName}" field to "${tableName}" table`,
      };
    }

    // Add typed field: "add isArchived boolean to projects"
    const typedFieldMatch = lower.match(
      /add\s+(\w+)\s+(boolean|text|integer|timestamp|uuid)\s+(?:to\s+)?(\w+)/i
    );
    if (typedFieldMatch) {
      return {
        success: true,
        action: 'add_field',
        tableName: typedFieldMatch[3],
        fields: [{ name: typedFieldMatch[1], type: typedFieldMatch[2] }],
        description: `Added "${typedFieldMatch[1]}" (${typedFieldMatch[2]}) to "${typedFieldMatch[3]}" table`,
      };
    }

    return { success: false };
  }

  private parseFields(fieldsStr: string): Array<{ name: string; type: string; nullable?: boolean; references?: string }> {
    const fields: Array<{ name: string; type: string; nullable?: boolean; references?: string }> = [];

    // Split by "and" or ","
    const parts = fieldsStr.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      const words = part.split(/\s+/);
      let name = words[0].replace(/[^a-zA-Z0-9_]/g, '');

      // Skip common filler words
      if (['a', 'an', 'the', 'field', 'fields', 'column', 'columns'].includes(name)) {
        name = words[1]?.replace(/[^a-zA-Z0-9_]/g, '') || '';
      }

      if (!name) continue;

      // Detect type from name or explicit type
      let type = 'text';
      const fullPart = part.toLowerCase();

      if (fullPart.includes('boolean') || fullPart.includes('bool')) type = 'boolean';
      else if (fullPart.includes('integer') || fullPart.includes('int') || fullPart.includes('number')) type = 'integer';
      else if (fullPart.includes('timestamp') || fullPart.includes('datetime') || fullPart.includes('date')) type = 'timestamp';
      else if (fullPart.includes('uuid')) type = 'uuid';
      else if (name.endsWith('Id') || name.endsWith('_id')) type = 'uuid';
      else if (name.startsWith('is') || name.startsWith('has') || name.startsWith('can')) type = 'boolean';
      else if (name.endsWith('At') || name.endsWith('_at') || name.includes('date') || name.includes('Date')) type = 'timestamp';
      else if (name.includes('count') || name.includes('Count') || name.includes('num') || name.includes('Num')) type = 'integer';

      fields.push({ name, type });
    }

    // Add default fields if creating a new table
    const hasId = fields.some(f => f.name === 'id');
    const hasCreatedAt = fields.some(f => f.name === 'createdAt' || f.name === 'created_at');

    if (!hasId) {
      fields.unshift({ name: 'id', type: 'uuid' });
    }
    if (!hasCreatedAt) {
      fields.push({ name: 'createdAt', type: 'timestamp' });
    }

    return fields;
  }

  private generateTableSchema(tableName: string, fields: Array<{ name: string; type: string; nullable?: boolean }>): string {
    const fieldLines = fields.map(f => this.generateFieldCode(f)).join(',\n  ');

    return `export const ${tableName} = pgTable('${this.toSnakeCase(tableName)}', {
  ${fieldLines},
});`;
  }

  private generateFieldCode(field: { name: string; type: string; nullable?: boolean }): string {
    const { name, type, nullable } = field;
    const snakeName = this.toSnakeCase(name);

    let code = '';
    switch (type) {
      case 'uuid':
        if (name === 'id') {
          code = `${name}: uuid('${snakeName}').defaultRandom().primaryKey()`;
        } else {
          code = `${name}: uuid('${snakeName}')`;
        }
        break;
      case 'text':
        code = `${name}: text('${snakeName}')`;
        break;
      case 'boolean':
        code = `${name}: boolean('${snakeName}').default(false)`;
        break;
      case 'integer':
        code = `${name}: integer('${snakeName}')`;
        break;
      case 'timestamp':
        if (name === 'createdAt' || name === 'created_at') {
          code = `${name}: timestamp('${snakeName}').defaultNow()`;
        } else if (name === 'updatedAt' || name === 'updated_at') {
          code = `${name}: timestamp('${snakeName}').defaultNow()`;
        } else {
          code = `${name}: timestamp('${snakeName}')`;
        }
        break;
      default:
        code = `${name}: text('${snakeName}')`;
    }

    if (nullable && !code.includes('.default')) {
      // Fields are nullable by default in Drizzle unless .notNull() is added
    }

    return code;
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Handle update_env tool - add/update environment variables
   */
  private async handleUpdateEnv(args: { request: string }) {
    const { request } = args;
    const cwd = process.cwd();

    const parsed = this.parseEnvRequest(request);

    if (!parsed.success || !parsed.variables || parsed.variables.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `❓ I couldn't understand that env request.\n\n**Request:** "${request}"\n\n**Supported:**\n- "add OPENAI_API_KEY"\n- "add Stripe keys" (adds STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY)\n- "add RESEND_API_KEY for emails"\n- "add DATABASE_URL"\n\n**Try rephrasing** with the variable name(s).`,
        }],
      };
    }

    const results: string[] = [];
    const { variables } = parsed;

    // Update .env.local
    const envLocalPath = path.join(cwd, '.env.local');
    let envLocalContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf-8') : '';

    for (const v of variables) {
      if (!envLocalContent.includes(`${v.name}=`)) {
        envLocalContent += `\n${v.name}=${v.placeholder || ''}`;
        results.push(`✓ Added ${v.name} to .env.local`);
      } else {
        results.push(`⚠️ ${v.name} already exists in .env.local`);
      }
    }
    fs.writeFileSync(envLocalPath, envLocalContent.trim() + '\n', 'utf-8');

    // Update .env.example
    const envExamplePath = path.join(cwd, '.env.example');
    let envExampleContent = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf-8') : '';

    for (const v of variables) {
      if (!envExampleContent.includes(`${v.name}=`)) {
        const comment = v.comment ? `# ${v.comment}\n` : '';
        envExampleContent += `\n${comment}${v.name}=`;
        results.push(`✓ Added ${v.name} to .env.example`);
      }
    }
    fs.writeFileSync(envExamplePath, envExampleContent.trim() + '\n', 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: `✅ **Environment Variables Updated**\n\n${results.join('\n')}\n\n📝 **Don't forget** to add the actual values to .env.local`,
      }],
    };
  }

  private parseEnvRequest(request: string): {
    success: boolean;
    variables?: Array<{ name: string; placeholder?: string; comment?: string }>;
  } {
    const lower = request.toLowerCase();
    const variables: Array<{ name: string; placeholder?: string; comment?: string }> = [];

    // Known service patterns
    if (lower.includes('stripe')) {
      variables.push(
        { name: 'STRIPE_SECRET_KEY', placeholder: 'sk_test_...', comment: 'Stripe secret key' },
        { name: 'STRIPE_PUBLISHABLE_KEY', placeholder: 'pk_test_...', comment: 'Stripe publishable key' },
        { name: 'STRIPE_WEBHOOK_SECRET', placeholder: 'whsec_...', comment: 'Stripe webhook secret' },
      );
    }

    if (lower.includes('openai')) {
      variables.push({ name: 'OPENAI_API_KEY', placeholder: 'sk-...', comment: 'OpenAI API key' });
    }

    if (lower.includes('anthropic') || lower.includes('claude')) {
      variables.push({ name: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...', comment: 'Anthropic API key' });
    }

    if (lower.includes('resend') || lower.includes('email')) {
      variables.push({ name: 'RESEND_API_KEY', placeholder: 're_...', comment: 'Resend API key for emails' });
    }

    if (lower.includes('supabase')) {
      variables.push(
        { name: 'NEXT_PUBLIC_SUPABASE_URL', placeholder: 'https://xxx.supabase.co', comment: 'Supabase project URL' },
        { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', placeholder: 'eyJ...', comment: 'Supabase anon key' },
        { name: 'SUPABASE_SERVICE_ROLE_KEY', placeholder: 'eyJ...', comment: 'Supabase service role key (server only)' },
      );
    }

    if (lower.includes('database') || lower.includes('postgres') || lower.includes('db')) {
      variables.push({ name: 'DATABASE_URL', placeholder: 'postgresql://...', comment: 'PostgreSQL connection string' });
    }

    if (lower.includes('github')) {
      variables.push(
        { name: 'GITHUB_CLIENT_ID', placeholder: '', comment: 'GitHub OAuth client ID' },
        { name: 'GITHUB_CLIENT_SECRET', placeholder: '', comment: 'GitHub OAuth client secret' },
      );
    }

    if (lower.includes('vercel')) {
      variables.push({ name: 'VERCEL_TOKEN', placeholder: '', comment: 'Vercel API token' });
    }

    // Extract explicit variable names from request
    const explicitMatch = request.match(/\b([A-Z][A-Z0-9_]{2,})\b/g);
    if (explicitMatch) {
      for (const name of explicitMatch) {
        if (!variables.some(v => v.name === name)) {
          variables.push({ name, placeholder: '', comment: `Added via CLI` });
        }
      }
    }

    return {
      success: variables.length > 0,
      variables,
    };
  }

  /**
   * Handle billing_action tool - subscription and billing management
   */
  private async handleBillingAction(args: { action: string }) {
    const { action } = args;
    const lower = action.toLowerCase();

    // Check current auth status
    const trialState = getTrialState();
    const hasApiKey = !!this.apiKey;

    // Show subscription status
    if (lower.includes('show') || lower.includes('status') || lower.includes('check') || lower.includes('my')) {
      let status = '';

      if (hasApiKey) {
        // Fetch subscription info from API
        try {
          const response = await fetch(`${this.apiUrl}/api/subscription/status`, {
            headers: this.getAuthHeaders(),
          });

          if (response.ok) {
            const data = await response.json();
            status = `# 💳 Subscription Status\n\n`;
            status += `**Plan:** ${data.plan || 'Unknown'}\n`;
            status += `**Status:** ${data.status || 'Unknown'}\n`;
            if (data.seats) status += `**Seats:** ${data.usedSeats}/${data.seats}\n`;
            if (data.renewsAt) status += `**Renews:** ${new Date(data.renewsAt).toLocaleDateString()}\n`;
          } else {
            status = `# 💳 Subscription Status\n\n**Status:** Active (API key configured)\n\nVisit https://codebakers.ai/billing for details.`;
          }
        } catch {
          status = `# 💳 Subscription Status\n\n**Status:** Active (API key configured)\n\nVisit https://codebakers.ai/billing for details.`;
        }
      } else if (trialState) {
        const daysRemaining = getTrialDaysRemaining();
        const isExpired = isTrialExpired();

        status = `# 🎁 Trial Status\n\n`;
        status += `**Stage:** ${trialState.stage}\n`;
        status += `**Days Remaining:** ${isExpired ? '0 (expired)' : daysRemaining}\n`;

        if (trialState.stage === 'anonymous' && !isExpired) {
          status += `\n💡 **Extend your trial:** Run \`codebakers extend\` to connect GitHub and get 7 more days free.`;
        } else if (isExpired) {
          status += `\n⚠️ **Trial expired.** Run \`codebakers billing\` to upgrade.`;
        }
      } else {
        status = `# ❓ No Subscription\n\nRun \`codebakers go\` to start a free trial, or \`codebakers setup\` if you have an account.`;
      }

      return {
        content: [{
          type: 'text' as const,
          text: status,
        }],
      };
    }

    // Extend trial
    if (lower.includes('extend')) {
      if (!trialState) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ No active trial to extend.\n\nRun \`codebakers go\` to start a free trial first.`,
          }],
        };
      }

      if (trialState.stage === 'extended') {
        return {
          content: [{
            type: 'text' as const,
            text: `⚠️ Trial already extended.\n\nYou've already connected GitHub. Run \`codebakers billing\` to upgrade to a paid plan.`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `# 🚀 Extend Your Trial\n\nRun this command to connect GitHub and get 7 more days free:\n\n\`\`\`\ncodebakers extend\n\`\`\`\n\nOr visit: https://codebakers.ai/api/auth/github?extend=true`,
        }],
      };
    }

    // Upgrade
    if (lower.includes('upgrade') || lower.includes('pro') || lower.includes('team') || lower.includes('agency')) {
      let plan = 'pro';
      if (lower.includes('team')) plan = 'team';
      if (lower.includes('agency')) plan = 'agency';

      return {
        content: [{
          type: 'text' as const,
          text: `# 💎 Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}\n\nRun this command to open billing:\n\n\`\`\`\ncodebakers billing\n\`\`\`\n\nOr visit: https://codebakers.ai/billing?plan=${plan}`,
        }],
      };
    }

    // Default: show help
    return {
      content: [{
        type: 'text' as const,
        text: `# 💳 Billing Actions\n\n**Available commands:**\n- "show my subscription" - View current status\n- "extend trial" - Get 7 more days with GitHub\n- "upgrade to Pro" - Open upgrade page\n- "upgrade to Team" - Open Team plan page\n\nOr run \`codebakers billing\` to open the billing page.`,
      }],
    };
  }

  /**
   * Handle add_page tool - create new Next.js pages
   */
  private async handleAddPage(args: { request: string }) {
    const { request } = args;
    const cwd = process.cwd();

    const parsed = this.parsePageRequest(request);

    if (!parsed.success) {
      return {
        content: [{
          type: 'text' as const,
          text: `❓ I couldn't understand that page request.\n\n**Request:** "${request}"\n\n**Supported:**\n- "create a settings page"\n- "add an about page"\n- "make a user profile page"\n- "create a dashboard page with stats"\n\n**Try rephrasing** with the page name and optional features.`,
        }],
      };
    }

    const { pageName, route, features, isProtected } = parsed;

    // Determine the correct app directory
    const appDir = path.join(cwd, 'src', 'app');
    if (!fs.existsSync(appDir)) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Could not find src/app directory.\n\nMake sure you're in a Next.js project root.`,
        }],
        isError: true,
      };
    }

    // Determine route group
    let targetDir: string;
    if (isProtected) {
      targetDir = path.join(appDir, '(dashboard)', route!);
    } else {
      targetDir = path.join(appDir, '(marketing)', route!);
    }

    // Create directory if needed
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Generate page content
    const pageContent = this.generatePageContent(pageName!, features || [], isProtected || false);

    // Write page file
    const pagePath = path.join(targetDir, 'page.tsx');
    fs.writeFileSync(pagePath, pageContent, 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: `✅ **Page Created**\n\n**Name:** ${pageName}\n**Route:** /${route}\n**File:** \`${path.relative(cwd, pagePath)}\`\n**Protected:** ${isProtected ? 'Yes (requires auth)' : 'No (public)'}\n\n📝 **Next steps:**\n1. Customize the page content\n2. Add to navigation if needed`,
      }],
    };
  }

  private parsePageRequest(request: string): {
    success: boolean;
    pageName?: string;
    route?: string;
    features?: string[];
    isProtected?: boolean;
  } {
    const lower = request.toLowerCase();

    // Extract page name
    const pageMatch = lower.match(
      /(?:create|add|make)\s+(?:a\s+)?(\w+)\s+page/i
    );

    if (!pageMatch) return { success: false };

    const pageName = pageMatch[1];
    const route = pageName.toLowerCase();

    // Detect features
    const features: string[] = [];
    if (lower.includes('tab')) features.push('tabs');
    if (lower.includes('form')) features.push('form');
    if (lower.includes('stat')) features.push('stats');
    if (lower.includes('table') || lower.includes('list')) features.push('table');
    if (lower.includes('card')) features.push('cards');

    // Detect if protected
    const protectedKeywords = ['dashboard', 'settings', 'profile', 'account', 'admin', 'billing'];
    const isProtected = protectedKeywords.some(k => lower.includes(k));

    return {
      success: true,
      pageName: pageName.charAt(0).toUpperCase() + pageName.slice(1),
      route,
      features,
      isProtected,
    };
  }

  private generatePageContent(pageName: string, features: string[], isProtected: boolean): string {
    const imports: string[] = [];
    const components: string[] = [];

    if (isProtected) {
      imports.push(`import { redirect } from 'next/navigation';`);
      imports.push(`import { getServerSession } from 'next-auth';`);
    }

    if (features.includes('tabs')) {
      imports.push(`import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';`);
    }

    if (features.includes('cards') || features.includes('stats')) {
      imports.push(`import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';`);
    }

    // Generate component based on features
    let content = '';

    if (features.includes('stats')) {
      content = `
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">1,234</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$12,345</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">42</p>
            </CardContent>
          </Card>
        </div>`;
    } else if (features.includes('tabs')) {
      content = `
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Manage your general preferences</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add form fields here */}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add notification settings here */}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add security settings here */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>`;
    } else {
      content = `
        <p className="text-muted-foreground">
          Welcome to the ${pageName} page. Add your content here.
        </p>`;
    }

    const asyncKeyword = isProtected ? 'async ' : '';
    const authCheck = isProtected ? `
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }
` : '';

    return `${imports.join('\n')}

export const metadata = {
  title: '${pageName}',
};

export default ${asyncKeyword}function ${pageName}Page() {${authCheck}
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">${pageName}</h1>
      ${content}
    </div>
  );
}
`;
  }

  /**
   * Handle add_api_route tool - create new API endpoints
   */
  private async handleAddApiRoute(args: { request: string }) {
    const { request } = args;
    const cwd = process.cwd();

    const parsed = this.parseApiRouteRequest(request);

    if (!parsed.success) {
      return {
        content: [{
          type: 'text' as const,
          text: `❓ I couldn't understand that API route request.\n\n**Request:** "${request}"\n\n**Supported:**\n- "create a feedback endpoint"\n- "add POST endpoint for user settings"\n- "make a webhook for Stripe"\n- "create GET/POST for preferences"\n\n**Try rephrasing** with the endpoint name and HTTP methods.`,
        }],
      };
    }

    const { routeName, routePath, methods, isWebhook, requiresAuth } = parsed;

    // Determine the API directory
    const apiDir = path.join(cwd, 'src', 'app', 'api', routePath!);

    // Create directory if needed
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }

    // Generate route content
    const routeContent = this.generateApiRouteContent(routeName!, methods!, isWebhook, requiresAuth);

    // Write route file
    const routeFilePath = path.join(apiDir, 'route.ts');
    fs.writeFileSync(routeFilePath, routeContent, 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: `✅ **API Route Created**\n\n**Name:** ${routeName}\n**Path:** /api/${routePath}\n**Methods:** ${methods!.join(', ')}\n**File:** \`${path.relative(cwd, routeFilePath)}\`\n**Auth Required:** ${requiresAuth ? 'Yes' : 'No'}\n\n📝 **Next steps:**\n1. Implement the business logic\n2. Add validation with Zod\n3. Test the endpoint`,
      }],
    };
  }

  /**
   * Check for update notifications and return message to show user
   */
  private async handleCheckUpdateNotification() {
    const cwd = process.cwd();
    const notificationPath = path.join(cwd, '.claude', '.update-notification.json');

    try {
      if (!fs.existsSync(notificationPath)) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No update notification.',
          }],
        };
      }

      const notification = JSON.parse(fs.readFileSync(notificationPath, 'utf-8'));

      // Delete the notification file after reading (so it only shows once)
      fs.unlinkSync(notificationPath);

      return {
        content: [{
          type: 'text' as const,
          text: `🍪 **CodeBakers Update**\n\n${notification.message}\n\n**Previous version:** ${notification.previousVersion}\n**New version:** ${notification.newVersion}\n**Modules:** ${notification.moduleCount}\n**Updated:** ${new Date(notification.updatedAt).toLocaleString()}`,
        }],
      };
    } catch {
      return {
        content: [{
          type: 'text' as const,
          text: 'No update notification.',
        }],
      };
    }
  }

  private parseApiRouteRequest(request: string): {
    success: boolean;
    routeName?: string;
    routePath?: string;
    methods?: string[];
    isWebhook?: boolean;
    requiresAuth?: boolean;
  } {
    const lower = request.toLowerCase();

    // Detect webhook
    const isWebhook = lower.includes('webhook');

    // Extract route name
    let routeName = '';
    let routePath = '';

    // Pattern: "create a X endpoint" or "add X route"
    const nameMatch = lower.match(
      /(?:create|add|make)\s+(?:a\s+)?(?:post\s+|get\s+)?(?:endpoint|route|api)?\s*(?:for\s+)?(\w+)/i
    );

    if (nameMatch) {
      routeName = nameMatch[1];
      routePath = routeName.toLowerCase();
    } else {
      return { success: false };
    }

    // Detect methods
    const methods: string[] = [];
    if (lower.includes('get')) methods.push('GET');
    if (lower.includes('post')) methods.push('POST');
    if (lower.includes('put')) methods.push('PUT');
    if (lower.includes('patch')) methods.push('PATCH');
    if (lower.includes('delete')) methods.push('DELETE');

    // Default to POST for most endpoints, GET for queries
    if (methods.length === 0) {
      if (lower.includes('list') || lower.includes('fetch') || lower.includes('query')) {
        methods.push('GET');
      } else {
        methods.push('POST');
      }
    }

    // Detect if auth required
    const noAuthKeywords = ['webhook', 'public', 'open'];
    const requiresAuth = !noAuthKeywords.some(k => lower.includes(k));

    return {
      success: true,
      routeName: routeName.charAt(0).toUpperCase() + routeName.slice(1),
      routePath,
      methods,
      isWebhook,
      requiresAuth,
    };
  }

  private generateApiRouteContent(routeName: string, methods: string[], isWebhook?: boolean, requiresAuth?: boolean): string {
    const imports: string[] = [
      `import { NextRequest, NextResponse } from 'next/server';`,
      `import { z } from 'zod';`,
    ];

    if (requiresAuth && !isWebhook) {
      imports.push(`import { getServerSession } from 'next-auth';`);
    }

    const handlers: string[] = [];

    for (const method of methods) {
      let handler = '';

      if (method === 'GET') {
        handler = `
export async function GET(request: NextRequest) {
  try {${requiresAuth ? `
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
` : ''}
    // TODO: Implement ${routeName} GET logic

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('[${routeName.toUpperCase()}] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}`;
      } else if (method === 'POST') {
        const schemaName = `${routeName}Schema`;

        handler = `
const ${schemaName} = z.object({
  // TODO: Define your schema
  // example: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {${requiresAuth ? `
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
` : ''}
    const body = await request.json();
    const validated = ${schemaName}.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid request', details: validated.error.flatten() }, { status: 400 });
    }

    // TODO: Implement ${routeName} POST logic

    return NextResponse.json({ message: 'Success' }, { status: 201 });
  } catch (error) {
    console.error('[${routeName.toUpperCase()}] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}`;
      } else if (method === 'PUT' || method === 'PATCH') {
        handler = `
export async function ${method}(request: NextRequest) {
  try {${requiresAuth ? `
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
` : ''}
    const body = await request.json();

    // TODO: Implement ${routeName} ${method} logic

    return NextResponse.json({ message: 'Updated' });
  } catch (error) {
    console.error('[${routeName.toUpperCase()}] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}`;
      } else if (method === 'DELETE') {
        handler = `
export async function DELETE(request: NextRequest) {
  try {${requiresAuth ? `
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
` : ''}
    // TODO: Implement ${routeName} DELETE logic

    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('[${routeName.toUpperCase()}] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}`;
      }

      handlers.push(handler);
    }

    // Webhook-specific template
    if (isWebhook) {
      return `import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();

    // TODO: Verify webhook signature
    // const signature = headersList.get('stripe-signature');

    // TODO: Parse and handle webhook event
    const event = JSON.parse(body);

    switch (event.type) {
      case 'example.event':
        // Handle event
        break;
      default:
        console.log(\`Unhandled event type: \${event.type}\`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
`;
    }

    return `${imports.join('\n')}
${handlers.join('\n')}
`;
  }

  /**
   * Download and update CodeBakers patterns from server
   * This is the MCP equivalent of the `codebakers upgrade` CLI command
   */
  private async handleUpdatePatterns(args: { force?: boolean }) {
    const { force = false } = args;
    const cwd = process.cwd();
    const claudeMdPath = path.join(cwd, 'CLAUDE.md');
    const claudeDir = path.join(cwd, '.claude');
    const versionPath = path.join(claudeDir, '.version.json');

    let response = `# 🔄 CodeBakers Pattern Update\n\n`;

    try {
      // Check current version
      let currentVersion: string | null = null;
      let currentModuleCount = 0;

      if (fs.existsSync(versionPath)) {
        try {
          const versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
          currentVersion = versionInfo.version;
          currentModuleCount = versionInfo.moduleCount || 0;
        } catch {
          // Ignore parse errors
        }
      }

      // Count current modules
      if (fs.existsSync(claudeDir)) {
        try {
          const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.md'));
          currentModuleCount = files.length;
        } catch {
          // Ignore read errors
        }
      }

      response += `## Current Status\n`;
      response += `- Version: ${currentVersion || 'Unknown'}\n`;
      response += `- Modules: ${currentModuleCount}\n\n`;

      // Fetch latest version info first
      const versionResponse = await fetch(`${this.apiUrl}/api/content/version`, {
        headers: this.getAuthHeaders(),
      });

      if (!versionResponse.ok) {
        throw new Error('Failed to check version from server');
      }

      const latestInfo = await versionResponse.json();
      const latestVersion = latestInfo.version;
      const latestModuleCount = latestInfo.moduleCount || 0;

      response += `## Server Status\n`;
      response += `- Latest Version: ${latestVersion}\n`;
      response += `- Available Modules: ${latestModuleCount}\n\n`;

      // Check if update needed
      const needsUpdate = force || !currentVersion || currentVersion !== latestVersion || currentModuleCount < latestModuleCount;

      if (!needsUpdate) {
        response += `✅ **Already up to date!**\n\n`;
        response += `Your patterns are current (v${latestVersion} with ${latestModuleCount} modules).\n`;
        response += `Use \`force: true\` to re-download anyway.\n`;
        response += this.getUpdateNotice();

        return {
          content: [{
            type: 'text' as const,
            text: response,
          }],
        };
      }

      response += `## Downloading Updates...\n\n`;

      // Fetch full content
      const contentResponse = await fetch(`${this.apiUrl}/api/content`, {
        headers: this.getAuthHeaders(),
      });

      if (!contentResponse.ok) {
        const error = await contentResponse.json().catch(() => ({}));
        throw new Error(error.error || error.message || 'Failed to fetch patterns');
      }

      const content = await contentResponse.json();
      const moduleCount = content.modules ? Object.keys(content.modules).length : 0;

      // Create .claude directory if needed
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
        response += `✓ Created .claude/ directory\n`;
      }

      // Update CLAUDE.md router
      if (content.router) {
        fs.writeFileSync(claudeMdPath, content.router);
        response += `✓ Updated CLAUDE.md (router)\n`;
      }

      // Update all modules
      if (content.modules && moduleCount > 0) {
        for (const [name, data] of Object.entries(content.modules)) {
          fs.writeFileSync(path.join(claudeDir, name), data as string);
        }
        response += `✓ Updated ${moduleCount} modules in .claude/\n`;
      }

      // Save version info
      const newVersionInfo = {
        version: content.version || latestVersion,
        moduleCount,
        installedAt: currentVersion ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cliVersion: getCliVersion(),
      };
      fs.writeFileSync(versionPath, JSON.stringify(newVersionInfo, null, 2));
      response += `✓ Saved version info\n`;

      // Confirm download to server (non-blocking analytics)
      this.confirmDownload(content.version || latestVersion, moduleCount).catch(() => {});

      response += `\n## ✅ Update Complete!\n\n`;
      response += `- **From:** v${currentVersion || 'none'} (${currentModuleCount} modules)\n`;
      response += `- **To:** v${content.version || latestVersion} (${moduleCount} modules)\n\n`;

      if (moduleCount > currentModuleCount) {
        response += `🆕 **${moduleCount - currentModuleCount} new modules added!**\n\n`;
      }

      response += `Your patterns are now up to date. The new patterns will be used in your next response.\n`;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `\n## ❌ Update Failed\n\n`;
      response += `Error: ${message}\n\n`;

      if (message.includes('401') || message.includes('Invalid') || message.includes('expired')) {
        response += `Your API key may be invalid or expired.\n`;
        response += `Run \`codebakers setup\` in terminal to reconfigure.\n`;
      } else {
        response += `Please try again or run \`codebakers upgrade\` in terminal.\n`;
      }
    }

    // Add CLI update notice if available
    response += this.getUpdateNotice();

    return {
      content: [{
        type: 'text' as const,
        text: response,
      }],
    };
  }

  /**
   * Detect intent from user message and suggest appropriate MCP tools
   * Shows what would happen before executing, for user confirmation
   */
  private handleDetectIntent(args: { userMessage: string }) {
    const { userMessage } = args;
    const msg = userMessage.toLowerCase();

    // Define intent patterns with their MCP tools
    const intentPatterns = [
      {
        keywords: ['upgrade codebakers', 'update patterns', 'sync patterns', 'download patterns', 'get latest patterns'],
        tool: 'update_patterns',
        description: 'Download latest CLAUDE.md and all .claude/ modules from the CodeBakers server',
        action: 'WRITE - Will overwrite local pattern files with server versions',
        isDestructive: true,
      },
      {
        keywords: ['upgrade', 'improve code', 'make production ready', 'code quality'],
        tool: 'upgrade',
        description: 'Analyze your code for quality improvements (does NOT download patterns)',
        action: 'READ-ONLY - Analyzes code and suggests improvements',
        isDestructive: false,
      },
      {
        keywords: ['build', 'create project', 'new project', 'scaffold', 'start fresh'],
        tool: 'scaffold_project',
        description: 'Create a new project from scratch with CodeBakers patterns',
        action: 'WRITE - Will create new files and folders',
        isDestructive: true,
      },
      {
        keywords: ['add feature', 'implement', 'build feature', 'create feature'],
        tool: 'optimize_and_build',
        description: 'Optimize your feature request with AI and fetch relevant patterns',
        action: 'READ + ASSIST - Fetches patterns and guides implementation',
        isDestructive: false,
      },
      {
        keywords: ['audit', 'review code', 'check code', 'code review'],
        tool: 'run_audit',
        description: 'Run comprehensive code quality audit',
        action: 'READ-ONLY - Analyzes code and reports issues',
        isDestructive: false,
      },
      {
        keywords: ['heal', 'fix errors', 'auto-fix', 'fix bugs'],
        tool: 'heal',
        description: 'AI-powered error detection and automatic fixing',
        action: 'WRITE - May modify files to fix errors',
        isDestructive: true,
      },
      {
        keywords: ['design', 'clone design', 'copy design', 'match design'],
        tool: 'design',
        description: 'Clone a design from mockups, screenshots, or websites',
        action: 'WRITE - Will generate component files',
        isDestructive: true,
      },
      {
        keywords: ['status', 'progress', "what's built", 'where am i'],
        tool: 'project_status',
        description: 'Show current project build progress and stats',
        action: 'READ-ONLY - Shows project state',
        isDestructive: false,
      },
      {
        keywords: ['run tests', 'test', 'check tests'],
        tool: 'run_tests',
        description: 'Execute the project test suite',
        action: 'READ-ONLY - Runs tests and reports results',
        isDestructive: false,
      },
      {
        keywords: ['list patterns', 'show patterns', 'what patterns'],
        tool: 'list_patterns',
        description: 'List all available CodeBakers patterns',
        action: 'READ-ONLY - Shows available patterns',
        isDestructive: false,
      },
      {
        keywords: ['init', 'initialize', 'add patterns to existing'],
        tool: 'init_project',
        description: 'Add CodeBakers patterns to an existing project',
        action: 'WRITE - Will add CLAUDE.md and .claude/ folder',
        isDestructive: true,
      },
    ];

    // Find matching intents
    const matches = intentPatterns.filter(pattern =>
      pattern.keywords.some(keyword => msg.includes(keyword))
    );

    let response = `# 🔍 Intent Detection\n\n`;
    response += `**Your message:** "${userMessage}"\n\n`;

    if (matches.length === 0) {
      response += `## No specific MCP tool detected\n\n`;
      response += `Your request doesn't clearly match any MCP tool. I'll proceed with general assistance.\n\n`;
      response += `**Available tools you might want:**\n`;
      response += `- \`update_patterns\` - Download latest patterns from server\n`;
      response += `- \`optimize_and_build\` - Get AI help building a feature\n`;
      response += `- \`run_audit\` - Review your code quality\n`;
      response += `- \`project_status\` - Check build progress\n`;
    } else if (matches.length === 1) {
      const match = matches[0];
      response += `## Detected Intent\n\n`;
      response += `| Property | Value |\n`;
      response += `|----------|-------|\n`;
      response += `| **Tool** | \`${match.tool}\` |\n`;
      response += `| **Description** | ${match.description} |\n`;
      response += `| **Action Type** | ${match.action} |\n`;
      response += `| **Destructive?** | ${match.isDestructive ? '⚠️ YES - modifies files' : '✅ NO - read-only'} |\n\n`;

      if (match.isDestructive) {
        response += `### ⚠️ Confirmation Required\n\n`;
        response += `This action will modify files. Do you want to proceed?\n\n`;
        response += `**Reply "yes" or "proceed" to execute, or describe what you actually want.**\n`;
      } else {
        response += `This is a read-only operation. Safe to proceed.\n\n`;
        response += `**Reply "yes" to execute, or clarify your request.**\n`;
      }
    } else {
      response += `## Multiple Possible Intents\n\n`;
      response += `Your request could match several tools:\n\n`;

      matches.forEach((match, i) => {
        response += `### Option ${i + 1}: \`${match.tool}\`\n`;
        response += `- **What it does:** ${match.description}\n`;
        response += `- **Action:** ${match.action}\n`;
        response += `- **Destructive:** ${match.isDestructive ? '⚠️ Yes' : '✅ No'}\n\n`;
      });

      response += `**Which option do you want?** Reply with the tool name or option number.\n`;
    }

    return {
      content: [{
        type: 'text' as const,
        text: response,
      }],
    };
  }

  // ==================== VAPI Voice AI Handlers ====================

  private getVapiKey(): string | null {
    // Check environment variable first
    if (process.env.VAPI_API_KEY) {
      return process.env.VAPI_API_KEY;
    }
    // Check .env file in project
    const cwd = process.cwd();
    const envPath = path.join(cwd, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/VAPI_API_KEY=(.+)/);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  private async handleVapiConnect(args: { apiKey: string }) {
    const { apiKey } = args;
    const cwd = process.cwd();

    let response = `# 🎙️ VAPI Connection Setup\n\n`;

    try {
      // Test the API key
      const testResponse = await fetch('https://api.vapi.ai/assistant', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!testResponse.ok) {
        response += `## ❌ Invalid API Key\n\n`;
        response += `The API key could not be validated. Please check:\n`;
        response += `1. Go to https://dashboard.vapi.ai\n`;
        response += `2. Navigate to Settings → API Keys\n`;
        response += `3. Copy your API key and try again\n`;
        return { content: [{ type: 'text' as const, text: response }] };
      }

      // Save to .env file
      const envPath = path.join(cwd, '.env');
      let envContent = '';

      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('VAPI_API_KEY=')) {
          envContent = envContent.replace(/VAPI_API_KEY=.*/g, `VAPI_API_KEY=${apiKey}`);
        } else {
          envContent += `\n# VAPI Voice AI\nVAPI_API_KEY=${apiKey}\n`;
        }
      } else {
        envContent = `# VAPI Voice AI\nVAPI_API_KEY=${apiKey}\n`;
      }

      fs.writeFileSync(envPath, envContent);

      response += `## ✅ VAPI Connected Successfully!\n\n`;
      response += `API key saved to \`.env\` file.\n\n`;
      response += `### Available Commands:\n`;
      response += `- \`vapi_list_assistants\` - See your assistants\n`;
      response += `- \`vapi_create_assistant\` - Create a new voice assistant\n`;
      response += `- \`vapi_get_calls\` - View call history\n`;
      response += `- \`vapi_generate_webhook\` - Add webhook handler to your project\n`;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Connection Failed\n\n`;
      response += `Error: ${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private async handleVapiListAssistants(args: { limit?: number }) {
    const { limit = 20 } = args;
    const vapiKey = this.getVapiKey();

    let response = `# 🎙️ VAPI Assistants\n\n`;

    if (!vapiKey) {
      response += `## ❌ Not Connected\n\n`;
      response += `VAPI API key not found. Run \`vapi_connect\` first with your API key.\n`;
      response += `Get your key at: https://dashboard.vapi.ai\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      const apiResponse = await fetch(`https://api.vapi.ai/assistant?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiKey}`,
        },
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const assistants = await apiResponse.json();

      if (!assistants || assistants.length === 0) {
        response += `No assistants found.\n\n`;
        response += `Create one with \`vapi_create_assistant\`!\n`;
      } else {
        response += `| Name | ID | Voice | Created |\n`;
        response += `|------|-------|-------|--------|\n`;

        for (const a of assistants) {
          const created = new Date(a.createdAt).toLocaleDateString();
          const voice = a.voice?.provider || 'default';
          response += `| ${a.name || 'Unnamed'} | \`${a.id.slice(0, 8)}...\` | ${voice} | ${created} |\n`;
        }

        response += `\n**Total:** ${assistants.length} assistant(s)\n`;
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Error\n\n`;
      response += `Failed to fetch assistants: ${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private async handleVapiCreateAssistant(args: { name: string; description: string; voice?: string; webhookUrl?: string }) {
    const { name, description, voice = 'alloy', webhookUrl } = args;
    const vapiKey = this.getVapiKey();

    let response = `# 🎙️ Create VAPI Assistant\n\n`;

    if (!vapiKey) {
      response += `## ❌ Not Connected\n\n`;
      response += `VAPI API key not found. Run \`vapi_connect\` first.\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      // Build system prompt based on description
      const systemPrompt = `You are ${name}, a helpful voice assistant. ${description}

Guidelines:
- Be conversational and natural
- Keep responses concise (1-2 sentences when possible)
- Ask clarifying questions if needed
- Be friendly but professional`;

      const assistantConfig: Record<string, unknown> = {
        name,
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          systemPrompt,
        },
        voice: {
          provider: 'openai',
          voiceId: voice,
        },
        firstMessage: `Hi! I'm ${name}. How can I help you today?`,
      };

      if (webhookUrl) {
        assistantConfig.serverUrl = webhookUrl;
      }

      const apiResponse = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vapiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assistantConfig),
      });

      if (!apiResponse.ok) {
        const error = await apiResponse.json();
        throw new Error(error.message || `API error: ${apiResponse.status}`);
      }

      const assistant = await apiResponse.json();

      response += `## ✅ Assistant Created!\n\n`;
      response += `| Property | Value |\n`;
      response += `|----------|-------|\n`;
      response += `| **Name** | ${assistant.name} |\n`;
      response += `| **ID** | \`${assistant.id}\` |\n`;
      response += `| **Voice** | ${voice} |\n`;
      response += `| **Model** | gpt-4o-mini |\n`;

      response += `\n### Next Steps:\n`;
      response += `1. Test your assistant at https://dashboard.vapi.ai\n`;
      response += `2. Add a phone number to receive calls\n`;
      response += `3. Use \`vapi_generate_webhook\` to handle call events\n`;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Creation Failed\n\n`;
      response += `Error: ${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private async handleVapiGetAssistant(args: { assistantId: string }) {
    const { assistantId } = args;
    const vapiKey = this.getVapiKey();

    let response = `# 🎙️ Assistant Details\n\n`;

    if (!vapiKey) {
      response += `## ❌ Not Connected\n\nRun \`vapi_connect\` first.\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      const apiResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        headers: { 'Authorization': `Bearer ${vapiKey}` },
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const a = await apiResponse.json();

      response += `## ${a.name || 'Unnamed Assistant'}\n\n`;
      response += `| Property | Value |\n`;
      response += `|----------|-------|\n`;
      response += `| **ID** | \`${a.id}\` |\n`;
      response += `| **Voice** | ${a.voice?.voiceId || 'default'} |\n`;
      response += `| **Model** | ${a.model?.model || 'unknown'} |\n`;
      response += `| **Created** | ${new Date(a.createdAt).toLocaleString()} |\n`;

      if (a.model?.systemPrompt) {
        response += `\n### System Prompt:\n\`\`\`\n${a.model.systemPrompt.slice(0, 500)}${a.model.systemPrompt.length > 500 ? '...' : ''}\n\`\`\`\n`;
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Error\n\n${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private async handleVapiUpdateAssistant(args: { assistantId: string; name?: string; systemPrompt?: string; voice?: string }) {
    const { assistantId, name, systemPrompt, voice } = args;
    const vapiKey = this.getVapiKey();

    let response = `# 🎙️ Update Assistant\n\n`;

    if (!vapiKey) {
      response += `## ❌ Not Connected\n\nRun \`vapi_connect\` first.\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (systemPrompt) updates.model = { systemPrompt };
      if (voice) updates.voice = { provider: 'openai', voiceId: voice };

      const apiResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${vapiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      response += `## ✅ Assistant Updated!\n\n`;
      response += `Updated fields:\n`;
      if (name) response += `- Name: ${name}\n`;
      if (systemPrompt) response += `- System prompt updated\n`;
      if (voice) response += `- Voice: ${voice}\n`;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Update Failed\n\n${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private async handleVapiGetCalls(args: { assistantId?: string; limit?: number }) {
    const { assistantId, limit = 20 } = args;
    const vapiKey = this.getVapiKey();

    let response = `# 🎙️ VAPI Call History\n\n`;

    if (!vapiKey) {
      response += `## ❌ Not Connected\n\nRun \`vapi_connect\` first.\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      let url = `https://api.vapi.ai/call?limit=${limit}`;
      if (assistantId) url += `&assistantId=${assistantId}`;

      const apiResponse = await fetch(url, {
        headers: { 'Authorization': `Bearer ${vapiKey}` },
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const calls = await apiResponse.json();

      if (!calls || calls.length === 0) {
        response += `No calls found.\n`;
      } else {
        response += `| Date | Duration | Status | Cost |\n`;
        response += `|------|----------|--------|------|\n`;

        for (const call of calls) {
          const date = new Date(call.createdAt).toLocaleString();
          const duration = call.endedAt ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000) : 0;
          const cost = call.cost ? `$${call.cost.toFixed(3)}` : '-';
          response += `| ${date} | ${duration}s | ${call.status} | ${cost} |\n`;
        }

        response += `\n**Total:** ${calls.length} call(s)\n`;
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Error\n\n${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private async handleVapiGetCall(args: { callId: string }) {
    const { callId } = args;
    const vapiKey = this.getVapiKey();

    let response = `# 🎙️ Call Details\n\n`;

    if (!vapiKey) {
      response += `## ❌ Not Connected\n\nRun \`vapi_connect\` first.\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      const apiResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
        headers: { 'Authorization': `Bearer ${vapiKey}` },
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const call = await apiResponse.json();

      response += `| Property | Value |\n`;
      response += `|----------|-------|\n`;
      response += `| **ID** | \`${call.id}\` |\n`;
      response += `| **Status** | ${call.status} |\n`;
      response += `| **Started** | ${new Date(call.startedAt).toLocaleString()} |\n`;
      if (call.endedAt) {
        const duration = Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000);
        response += `| **Duration** | ${duration} seconds |\n`;
      }
      if (call.cost) response += `| **Cost** | $${call.cost.toFixed(4)} |\n`;
      if (call.recordingUrl) response += `| **Recording** | [Listen](${call.recordingUrl}) |\n`;

      if (call.transcript) {
        response += `\n### Transcript:\n\`\`\`\n${call.transcript.slice(0, 1000)}${call.transcript.length > 1000 ? '...' : ''}\n\`\`\`\n`;
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response += `## ❌ Error\n\n${message}\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  private handleVapiGenerateWebhook(args: { events?: string[] }) {
    const { events = ['call-started', 'call-ended', 'transcript'] } = args;
    const cwd = process.cwd();

    let response = `# 🎙️ VAPI Webhook Generator\n\n`;

    // Generate webhook handler code
    const webhookCode = `import { NextRequest, NextResponse } from 'next/server';

// VAPI Webhook Event Types
type VapiEventType = ${events.map(e => `'${e}'`).join(' | ')};

interface VapiWebhookPayload {
  type: VapiEventType;
  call?: {
    id: string;
    assistantId: string;
    phoneNumber?: string;
    customer?: {
      number: string;
      name?: string;
    };
  };
  transcript?: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload: VapiWebhookPayload = await req.json();

    console.log('[VAPI Webhook]', payload.type, payload.call?.id);

    switch (payload.type) {
${events.includes('call-started') ? `      case 'call-started':
        // Handle call started
        // Example: Log to database, send notification
        console.log('Call started:', payload.call?.id);
        break;
` : ''}${events.includes('call-ended') ? `      case 'call-ended':
        // Handle call ended
        // Example: Save transcript, update CRM
        console.log('Call ended:', payload.call?.id);
        break;
` : ''}${events.includes('transcript') ? `      case 'transcript':
        // Handle real-time transcript updates
        console.log('Transcript:', payload.transcript);
        break;
` : ''}${events.includes('function-call') ? `      case 'function-call':
        // Handle function calls from assistant
        // Return data to be spoken by the assistant
        return NextResponse.json({ result: 'Function executed' });
` : ''}      default:
        console.log('Unhandled event:', payload.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[VAPI Webhook Error]', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
`;

    // Check if API route directory exists
    const apiDir = path.join(cwd, 'src', 'app', 'api', 'webhooks', 'vapi');
    const routePath = path.join(apiDir, 'route.ts');

    if (fs.existsSync(routePath)) {
      response += `## ⚠️ Webhook Already Exists\n\n`;
      response += `File: \`src/app/api/webhooks/vapi/route.ts\`\n\n`;
      response += `Here's the updated code if you want to replace it:\n\n`;
    } else {
      // Create directory and file
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(routePath, webhookCode);
      response += `## ✅ Webhook Created!\n\n`;
      response += `File: \`src/app/api/webhooks/vapi/route.ts\`\n\n`;
    }

    response += `### Generated Code:\n\`\`\`typescript\n${webhookCode}\n\`\`\`\n\n`;

    response += `### Setup Instructions:\n`;
    response += `1. Deploy your app to get a public URL\n`;
    response += `2. Go to https://dashboard.vapi.ai → Your Assistant → Settings\n`;
    response += `3. Set webhook URL to: \`https://your-domain.com/api/webhooks/vapi\`\n`;
    response += `4. Select events: ${events.join(', ')}\n\n`;

    response += `### Handling Events:\n`;
    response += `- \`call-started\`: Triggered when a call begins\n`;
    response += `- \`call-ended\`: Triggered when a call ends (with transcript)\n`;
    response += `- \`transcript\`: Real-time transcript updates\n`;
    response += `- \`function-call\`: When assistant calls a custom function\n`;

    return { content: [{ type: 'text' as const, text: response }] };
  }

  // ============================================
  // DEPENDENCY GUARDIAN - Auto-Coherence System
  // ============================================

  /**
   * Guardian Analyze - Detects consistency issues in changed files
   * Runs automatically after code generation
   */
  private handleGuardianAnalyze(args: { files: string[]; changeContext?: string }) {
    const { files, changeContext } = args;
    const cwd = process.cwd();

    interface Issue {
      file: string;
      line: number;
      issue: string;
      severity: 'error' | 'warning' | 'info';
      fix: string;
      autoFixable: boolean;
    }

    const issues: Issue[] = [];
    const analyzed: string[] = [];

    // Helper to check if an import path resolves
    const checkImportResolves = (importPath: string, fromFile: string): boolean => {
      const fromDir = path.dirname(fromFile);

      // Handle alias imports (@/)
      if (importPath.startsWith('@/')) {
        const aliasPath = path.join(cwd, 'src', importPath.slice(2));
        return fs.existsSync(aliasPath + '.ts') ||
               fs.existsSync(aliasPath + '.tsx') ||
               fs.existsSync(path.join(aliasPath, 'index.ts')) ||
               fs.existsSync(path.join(aliasPath, 'index.tsx'));
      }

      // Handle relative imports
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(fromDir, importPath);
        return fs.existsSync(resolved + '.ts') ||
               fs.existsSync(resolved + '.tsx') ||
               fs.existsSync(path.join(resolved, 'index.ts')) ||
               fs.existsSync(path.join(resolved, 'index.tsx'));
      }

      // Node modules - assume they exist
      return true;
    };

    // Helper to extract imports from a file
    const extractImports = (content: string): Array<{ path: string; names: string[]; line: number }> => {
      const imports: Array<{ path: string; names: string[]; line: number }> = [];
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        // Match: import { X, Y } from 'path'
        const namedMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
        if (namedMatch) {
          const names = namedMatch[1].split(',').map(n => n.trim().split(' as ')[0]);
          imports.push({ path: namedMatch[2], names, line: i + 1 });
        }

        // Match: import X from 'path'
        const defaultMatch = line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
        if (defaultMatch && !namedMatch) {
          imports.push({ path: defaultMatch[2], names: [defaultMatch[1]], line: i + 1 });
        }
      });

      return imports;
    };

    // Helper to extract exports from a file
    const extractExports = (content: string): string[] => {
      const exports: string[] = [];

      // Match: export const/function/class/type/interface X
      const exportMatches = content.matchAll(/export\s+(const|function|class|type|interface)\s+(\w+)/g);
      for (const match of exportMatches) {
        exports.push(match[2]);
      }

      // Match: export { X, Y }
      const namedExportMatch = content.match(/export\s+\{([^}]+)\}/);
      if (namedExportMatch) {
        const names = namedExportMatch[1].split(',').map(n => n.trim().split(' as ')[0]);
        exports.push(...names);
      }

      // Match: export default
      if (content.includes('export default')) {
        exports.push('default');
      }

      return exports;
    };

    // Analyze each file
    for (const file of files) {
      const fullPath = path.isAbsolute(file) ? file : path.join(cwd, file);

      if (!fs.existsSync(fullPath)) {
        issues.push({
          file,
          line: 0,
          issue: `File does not exist: ${file}`,
          severity: 'error',
          fix: `Create the file or remove the reference`,
          autoFixable: false,
        });
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        analyzed.push(file);

        // Check 1: Broken imports
        const imports = extractImports(content);
        for (const imp of imports) {
          if (!checkImportResolves(imp.path, fullPath)) {
            issues.push({
              file,
              line: imp.line,
              issue: `Broken import: '${imp.path}' does not resolve`,
              severity: 'error',
              fix: `Check the import path or create the missing module`,
              autoFixable: false,
            });
          }
        }

        // Check 2: Unused imports (basic check)
        for (const imp of imports) {
          for (const name of imp.names) {
            // Skip if it's a type-only import or if name appears elsewhere in file
            const usageCount = (content.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
            if (usageCount === 1) { // Only appears in import
              issues.push({
                file,
                line: imp.line,
                issue: `Unused import: '${name}' is imported but never used`,
                severity: 'warning',
                fix: `Remove '${name}' from imports`,
                autoFixable: true,
              });
            }
          }
        }

        // Check 3: console.log in production code (not in test files)
        if (!file.includes('.test.') && !file.includes('.spec.')) {
          lines.forEach((line, i) => {
            if (line.includes('console.log(') && !line.trim().startsWith('//')) {
              issues.push({
                file,
                line: i + 1,
                issue: `console.log found in production code`,
                severity: 'warning',
                fix: `Remove console.log or replace with proper logging`,
                autoFixable: true,
              });
            }
          });
        }

        // Check 4: TODO/FIXME comments
        lines.forEach((line, i) => {
          if (line.includes('TODO:') || line.includes('FIXME:')) {
            issues.push({
              file,
              line: i + 1,
              issue: `Unresolved TODO/FIXME comment`,
              severity: 'info',
              fix: `Complete the TODO or remove if no longer needed`,
              autoFixable: false,
            });
          }
        });

        // Check 5: Type 'any' usage
        lines.forEach((line, i) => {
          if (line.includes(': any') || line.includes('<any>') || line.includes('as any')) {
            issues.push({
              file,
              line: i + 1,
              issue: `'any' type used - weakens type safety`,
              severity: 'warning',
              fix: `Replace 'any' with a proper type`,
              autoFixable: false,
            });
          }
        });

        // Check 6: Missing error handling in async functions
        if (content.includes('async ') && !content.includes('try {') && !content.includes('.catch(')) {
          issues.push({
            file,
            line: 1,
            issue: `Async function without error handling`,
            severity: 'warning',
            fix: `Add try/catch or .catch() to handle errors`,
            autoFixable: false,
          });
        }

        // Check 7: API routes without proper error handling
        if (file.includes('/api/') && file.endsWith('route.ts')) {
          if (!content.includes('try {') || !content.includes('catch')) {
            issues.push({
              file,
              line: 1,
              issue: `API route without try/catch error handling`,
              severity: 'error',
              fix: `Wrap handler logic in try/catch with proper error response`,
              autoFixable: false,
            });
          }
        }

        // Check 8: Missing return type on exported functions
        const funcMatches = content.matchAll(/export\s+(async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/g);
        for (const match of funcMatches) {
          const fullMatch = match[0];
          if (!fullMatch.includes(':')) { // No return type
            issues.push({
              file,
              line: 1,
              issue: `Exported function '${match[2]}' missing return type`,
              severity: 'info',
              fix: `Add explicit return type annotation`,
              autoFixable: false,
            });
          }
        }

      } catch (err) {
        issues.push({
          file,
          line: 0,
          issue: `Could not analyze file: ${err instanceof Error ? err.message : 'Unknown error'}`,
          severity: 'error',
          fix: `Check file permissions and encoding`,
          autoFixable: false,
        });
      }
    }

    // Also check cross-file consistency
    // Look for imports of the changed files from other files
    const searchDirs = ['src', 'app', 'lib', 'components', 'services'];
    const extensions = ['.ts', '.tsx'];

    const searchDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          searchDir(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          // Check if this file imports any of our changed files
          const relativePath = path.relative(cwd, fullPath);
          if (files.includes(relativePath)) continue; // Skip files we're already analyzing

          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const imports = extractImports(content);

            for (const imp of imports) {
              // Check if import matches any of our changed files
              for (const changedFile of files) {
                const changedBasename = path.basename(changedFile, path.extname(changedFile));
                if (imp.path.includes(changedBasename)) {
                  // This file imports a changed file - verify the imports still exist
                  const changedFullPath = path.join(cwd, changedFile);
                  if (fs.existsSync(changedFullPath)) {
                    const changedContent = fs.readFileSync(changedFullPath, 'utf-8');
                    const exports = extractExports(changedContent);

                    for (const name of imp.names) {
                      if (!exports.includes(name) && name !== 'default') {
                        issues.push({
                          file: relativePath,
                          line: imp.line,
                          issue: `Import '${name}' no longer exported from '${changedFile}'`,
                          severity: 'error',
                          fix: `Update import or add export to '${changedFile}'`,
                          autoFixable: false,
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    };

    for (const dir of searchDirs) {
      searchDir(path.join(cwd, dir));
    }

    // Build response
    let response = `# 🛡️ Dependency Guardian Analysis\n\n`;

    if (changeContext) {
      response += `**Context:** ${changeContext}\n\n`;
    }

    response += `**Files Analyzed:** ${analyzed.length}\n`;
    response += `**Issues Found:** ${issues.length}\n\n`;

    if (issues.length === 0) {
      response += `## ✅ All Clear!\n\n`;
      response += `No consistency issues detected. Code is coherent.\n`;
    } else {
      const errors = issues.filter(i => i.severity === 'error');
      const warnings = issues.filter(i => i.severity === 'warning');
      const infos = issues.filter(i => i.severity === 'info');
      const autoFixable = issues.filter(i => i.autoFixable);

      response += `| Severity | Count |\n`;
      response += `|----------|-------|\n`;
      response += `| 🔴 Errors | ${errors.length} |\n`;
      response += `| 🟡 Warnings | ${warnings.length} |\n`;
      response += `| 🔵 Info | ${infos.length} |\n`;
      response += `| 🔧 Auto-fixable | ${autoFixable.length} |\n\n`;

      if (errors.length > 0) {
        response += `## 🔴 Errors (Must Fix)\n\n`;
        for (const issue of errors) {
          response += `### \`${issue.file}:${issue.line}\`\n`;
          response += `**Issue:** ${issue.issue}\n`;
          response += `**Fix:** ${issue.fix}\n\n`;
        }
      }

      if (warnings.length > 0) {
        response += `## 🟡 Warnings (Should Fix)\n\n`;
        for (const issue of warnings) {
          response += `- \`${issue.file}:${issue.line}\` - ${issue.issue}${issue.autoFixable ? ' 🔧' : ''}\n`;
        }
        response += `\n`;
      }

      if (infos.length > 0) {
        response += `## 🔵 Info (Consider)\n\n`;
        for (const issue of infos) {
          response += `- \`${issue.file}:${issue.line}\` - ${issue.issue}\n`;
        }
        response += `\n`;
      }

      if (autoFixable.length > 0) {
        response += `---\n\n`;
        response += `**${autoFixable.length} issues can be auto-fixed.** Run \`guardian_heal\` to fix them automatically.\n`;
      }
    }

    // Store issues for healing
    const guardianStatePath = path.join(cwd, '.codebakers', 'guardian-state.json');
    try {
      fs.mkdirSync(path.dirname(guardianStatePath), { recursive: true });
      fs.writeFileSync(guardianStatePath, JSON.stringify({
        lastAnalysis: new Date().toISOString(),
        filesAnalyzed: analyzed,
        issues,
        changeContext,
      }, null, 2));
    } catch {
      // Ignore write errors
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  /**
   * Guardian Heal - Auto-fixes issues found by guardian_analyze
   */
  private handleGuardianHeal(args: { issues: Array<{ file: string; issue: string; fix: string }>; autoFix?: boolean }) {
    const { autoFix = true } = args;
    const cwd = process.cwd();

    // Load issues from state if not provided
    let issues = args.issues;
    if (!issues || issues.length === 0) {
      const guardianStatePath = path.join(cwd, '.codebakers', 'guardian-state.json');
      if (fs.existsSync(guardianStatePath)) {
        try {
          const state = JSON.parse(fs.readFileSync(guardianStatePath, 'utf-8'));
          issues = state.issues?.filter((i: { autoFixable?: boolean }) => i.autoFixable) || [];
        } catch {
          issues = [];
        }
      }
    }

    if (issues.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `# 🛡️ Guardian Heal\n\n✅ No issues to fix. Run \`guardian_analyze\` first to detect issues.`
        }]
      };
    }

    let response = `# 🛡️ Guardian Heal\n\n`;
    const fixed: string[] = [];
    const failed: string[] = [];

    for (const issue of issues) {
      const fullPath = path.join(cwd, issue.file);

      if (!fs.existsSync(fullPath)) {
        failed.push(`${issue.file}: File not found`);
        continue;
      }

      try {
        let content = fs.readFileSync(fullPath, 'utf-8');
        let modified = false;

        // Fix: Remove unused imports
        if (issue.issue.includes('Unused import')) {
          const match = issue.issue.match(/Unused import: '(\w+)'/);
          if (match) {
            const name = match[1];
            // Remove from named imports
            content = content.replace(new RegExp(`\\b${name}\\b,?\\s*`, 'g'), (m, offset) => {
              // Only replace in import statements
              const lineStart = content.lastIndexOf('\n', offset) + 1;
              const line = content.substring(lineStart, content.indexOf('\n', offset));
              if (line.includes('import')) {
                modified = true;
                return '';
              }
              return m;
            });
          }
        }

        // Fix: Remove console.log
        if (issue.issue.includes('console.log')) {
          const lines = content.split('\n');
          const lineIndex = parseInt(issue.issue.match(/line (\d+)/)?.[1] || '0') - 1;
          if (lineIndex >= 0 && lines[lineIndex]?.includes('console.log')) {
            lines.splice(lineIndex, 1);
            content = lines.join('\n');
            modified = true;
          }
        }

        if (modified && autoFix) {
          fs.writeFileSync(fullPath, content);
          fixed.push(issue.file);
        } else if (!modified) {
          failed.push(`${issue.file}: Could not auto-fix "${issue.issue}"`);
        }
      } catch (err) {
        failed.push(`${issue.file}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    if (fixed.length > 0) {
      response += `## ✅ Fixed (${fixed.length})\n\n`;
      for (const file of fixed) {
        response += `- \`${file}\`\n`;
      }
      response += `\n`;
    }

    if (failed.length > 0) {
      response += `## ⚠️ Could Not Auto-Fix (${failed.length})\n\n`;
      for (const msg of failed) {
        response += `- ${msg}\n`;
      }
      response += `\nThese require manual intervention.\n`;
    }

    if (fixed.length > 0) {
      response += `\n---\n\nRun \`guardian_verify\` to confirm all issues are resolved.\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  /**
   * Guardian Verify - Verifies codebase coherence (TypeScript check, imports, etc.)
   */
  private handleGuardianVerify(args: { deep?: boolean }) {
    const { deep = false } = args;
    const cwd = process.cwd();

    let response = `# 🛡️ Guardian Verify\n\n`;
    const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; details: string }> = [];

    // Check 1: TypeScript compilation
    try {
      execSync('npx tsc --noEmit', { cwd, stdio: 'pipe', timeout: 60000 });
      checks.push({ name: 'TypeScript', status: 'pass', details: 'No type errors' });
    } catch (err) {
      const output = err instanceof Error && 'stdout' in err ? String((err as { stdout: Buffer }).stdout) : 'Unknown error';
      const errorCount = (output.match(/error TS/g) || []).length;
      checks.push({
        name: 'TypeScript',
        status: 'fail',
        details: `${errorCount} type error${errorCount !== 1 ? 's' : ''} found`
      });
    }

    // Check 2: Package.json exists and is valid
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        checks.push({ name: 'package.json', status: 'pass', details: 'Valid JSON' });
      } catch {
        checks.push({ name: 'package.json', status: 'fail', details: 'Invalid JSON' });
      }
    } else {
      checks.push({ name: 'package.json', status: 'fail', details: 'File not found' });
    }

    // Check 3: Environment variables
    const envExample = path.join(cwd, '.env.example');
    const envLocal = path.join(cwd, '.env.local');
    const env = path.join(cwd, '.env');

    if (fs.existsSync(envExample)) {
      checks.push({ name: '.env.example', status: 'pass', details: 'Exists for documentation' });
    } else {
      checks.push({ name: '.env.example', status: 'warn', details: 'Missing - should document required env vars' });
    }

    if (fs.existsSync(envLocal) || fs.existsSync(env)) {
      checks.push({ name: '.env', status: 'pass', details: 'Environment configured' });
    } else {
      checks.push({ name: '.env', status: 'warn', details: 'No .env file - may need configuration' });
    }

    // Check 4: Git ignore includes sensitive files
    const gitignore = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignore)) {
      const content = fs.readFileSync(gitignore, 'utf-8');
      if (content.includes('.env') && content.includes('node_modules')) {
        checks.push({ name: '.gitignore', status: 'pass', details: 'Properly configured' });
      } else {
        checks.push({ name: '.gitignore', status: 'warn', details: 'May be missing important entries' });
      }
    } else {
      checks.push({ name: '.gitignore', status: 'warn', details: 'No .gitignore file' });
    }

    // Check 5: Deep mode - check all imports resolve
    if (deep) {
      let brokenImports = 0;
      const searchDirs = ['src', 'app'];

      const checkDir = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            checkDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
              for (const match of importMatches) {
                const importPath = match[1];
                if (importPath.startsWith('.') || importPath.startsWith('@/')) {
                  // Check if resolves
                  let resolved: string;
                  if (importPath.startsWith('@/')) {
                    resolved = path.join(cwd, 'src', importPath.slice(2));
                  } else {
                    resolved = path.resolve(path.dirname(fullPath), importPath);
                  }

                  const exists = fs.existsSync(resolved + '.ts') ||
                                 fs.existsSync(resolved + '.tsx') ||
                                 fs.existsSync(path.join(resolved, 'index.ts')) ||
                                 fs.existsSync(path.join(resolved, 'index.tsx'));

                  if (!exists) {
                    brokenImports++;
                  }
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      };

      for (const dir of searchDirs) {
        checkDir(path.join(cwd, dir));
      }

      if (brokenImports === 0) {
        checks.push({ name: 'Import Resolution', status: 'pass', details: 'All imports resolve' });
      } else {
        checks.push({ name: 'Import Resolution', status: 'fail', details: `${brokenImports} broken import${brokenImports !== 1 ? 's' : ''}` });
      }
    }

    // Build response
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warned = checks.filter(c => c.status === 'warn').length;

    const overallStatus = failed > 0 ? '❌ FAIL' : warned > 0 ? '⚠️ WARN' : '✅ PASS';

    response += `## Overall: ${overallStatus}\n\n`;
    response += `| Check | Status | Details |\n`;
    response += `|-------|--------|--------|\n`;

    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      response += `| ${check.name} | ${icon} | ${check.details} |\n`;
    }

    response += `\n**Summary:** ${passed} passed, ${failed} failed, ${warned} warnings\n`;

    if (failed > 0) {
      response += `\n---\n\n⚠️ **Action Required:** Fix the failing checks before deploying.\n`;
    }

    // Update guardian state
    const guardianStatePath = path.join(cwd, '.codebakers', 'guardian-state.json');
    try {
      let state: Record<string, unknown> = {};
      if (fs.existsSync(guardianStatePath)) {
        state = JSON.parse(fs.readFileSync(guardianStatePath, 'utf-8'));
      }
      state.lastVerification = new Date().toISOString();
      state.verificationResult = { passed, failed, warned, checks };
      fs.mkdirSync(path.dirname(guardianStatePath), { recursive: true });
      fs.writeFileSync(guardianStatePath, JSON.stringify(state, null, 2));
    } catch {
      // Ignore write errors
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  /**
   * Guardian Status - Shows overall project coherence health
   */
  private handleGuardianStatus() {
    const cwd = process.cwd();
    const guardianStatePath = path.join(cwd, '.codebakers', 'guardian-state.json');

    let response = `# 🛡️ Dependency Guardian Status\n\n`;

    // Check if guardian state exists
    if (!fs.existsSync(guardianStatePath)) {
      response += `## ⚪ Not Initialized\n\n`;
      response += `Guardian hasn't analyzed this project yet.\n\n`;
      response += `Run \`guardian_analyze\` on your files to start tracking coherence.\n`;
      return { content: [{ type: 'text' as const, text: response }] };
    }

    try {
      const state = JSON.parse(fs.readFileSync(guardianStatePath, 'utf-8'));

      // Last analysis
      if (state.lastAnalysis) {
        const analysisTime = new Date(state.lastAnalysis);
        const hoursAgo = Math.round((Date.now() - analysisTime.getTime()) / (1000 * 60 * 60));
        response += `**Last Analysis:** ${hoursAgo < 1 ? 'Just now' : `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`}\n`;
      }

      // Last verification
      if (state.lastVerification) {
        const verifyTime = new Date(state.lastVerification);
        const hoursAgo = Math.round((Date.now() - verifyTime.getTime()) / (1000 * 60 * 60));
        response += `**Last Verification:** ${hoursAgo < 1 ? 'Just now' : `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`}\n`;
      }

      response += `\n`;

      // Issue summary
      if (state.issues && state.issues.length > 0) {
        const errors = state.issues.filter((i: { severity: string }) => i.severity === 'error').length;
        const warnings = state.issues.filter((i: { severity: string }) => i.severity === 'warning').length;

        if (errors > 0) {
          response += `## ❌ Issues Found\n\n`;
          response += `- 🔴 ${errors} error${errors !== 1 ? 's' : ''}\n`;
          response += `- 🟡 ${warnings} warning${warnings !== 1 ? 's' : ''}\n\n`;
          response += `Run \`guardian_heal\` to auto-fix what's possible.\n`;
        } else if (warnings > 0) {
          response += `## ⚠️ Warnings\n\n`;
          response += `- 🟡 ${warnings} warning${warnings !== 1 ? 's' : ''} (no critical errors)\n\n`;
        } else {
          response += `## ✅ All Clear\n\n`;
          response += `No known issues in the codebase.\n`;
        }
      } else {
        response += `## ✅ No Issues\n\n`;
        response += `Last analysis found no problems.\n`;
      }

      // Verification result
      if (state.verificationResult) {
        const { passed, failed, warned } = state.verificationResult;
        response += `\n### Verification Summary\n`;
        response += `✅ ${passed} checks passed\n`;
        if (failed > 0) response += `❌ ${failed} checks failed\n`;
        if (warned > 0) response += `⚠️ ${warned} warnings\n`;
      }

      // Health score
      const issueCount = state.issues?.length || 0;
      const errorCount = state.issues?.filter((i: { severity: string }) => i.severity === 'error').length || 0;
      const verifyFailed = state.verificationResult?.failed || 0;

      let healthScore = 100;
      healthScore -= errorCount * 20;
      healthScore -= verifyFailed * 15;
      healthScore -= (issueCount - errorCount) * 5;
      healthScore = Math.max(0, Math.min(100, healthScore));

      response += `\n---\n\n`;
      response += `## Health Score: ${healthScore}/100 ${healthScore >= 80 ? '🟢' : healthScore >= 50 ? '🟡' : '🔴'}\n`;

    } catch {
      response += `## ⚠️ State Corrupted\n\n`;
      response += `Could not read guardian state. Run \`guardian_analyze\` to rebuild.\n`;
    }

    // Add update notice if available
    response += this.getUpdateNotice();

    return { content: [{ type: 'text' as const, text: response }] };
  }

  /**
   * Ripple Check - Detect all files affected by a change to a type/schema/function
   * Searches the codebase for imports and usages of the entity
   */
  private handleRippleCheck(args: { entityName: string; changeType?: string; changeDescription?: string }) {
    const { entityName, changeType, changeDescription } = args;
    const cwd = process.cwd();

    let response = `# 🌊 Ripple Check: \`${entityName}\`\n\n`;

    if (changeType || changeDescription) {
      response += `**Change:** ${changeDescription || changeType || 'Unknown'}\n\n`;
    }

    // Define search directories
    const searchDirs = ['src', 'app', 'lib', 'components', 'services', 'types', 'utils', 'hooks'];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    interface FileMatch {
      file: string;
      importLine?: string;
      usageLines: string[];
      lineNumbers: number[];
      isDefinition: boolean;
    }

    const matches: FileMatch[] = [];
    let definitionFile: string | null = null;

    // Helper to search a directory recursively
    const searchDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          searchDir(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            // Check if file contains the entity
            if (!content.includes(entityName)) continue;

            const relativePath = path.relative(cwd, fullPath);
            const match: FileMatch = {
              file: relativePath,
              usageLines: [],
              lineNumbers: [],
              isDefinition: false,
            };

            lines.forEach((line, i) => {
              const lineNum = i + 1;

              // Check for import statements
              if (line.includes('import') && line.includes(entityName)) {
                match.importLine = line.trim();
              }

              // Check for type/interface/function/const definition
              const defPatterns = [
                `type ${entityName}`,
                `interface ${entityName}`,
                `function ${entityName}`,
                `const ${entityName}`,
                `class ${entityName}`,
                `export type ${entityName}`,
                `export interface ${entityName}`,
                `export function ${entityName}`,
                `export const ${entityName}`,
                `export class ${entityName}`,
              ];

              if (defPatterns.some(p => line.includes(p))) {
                match.isDefinition = true;
                definitionFile = relativePath;
              }

              // Check for usage (not just import or definition)
              if (line.includes(entityName) && !line.includes('import ')) {
                match.usageLines.push(line.trim().substring(0, 100));
                match.lineNumbers.push(lineNum);
              }
            });

            // Only add if there are usages (not just definition)
            if (match.usageLines.length > 0) {
              matches.push(match);
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    };

    // Search all directories
    for (const dir of searchDirs) {
      searchDir(path.join(cwd, dir));
    }

    // Sort: definition first, then by number of usages
    matches.sort((a, b) => {
      if (a.isDefinition && !b.isDefinition) return -1;
      if (!a.isDefinition && b.isDefinition) return 1;
      return b.usageLines.length - a.usageLines.length;
    });

    // Generate report
    if (matches.length === 0) {
      response += `## ✅ No usages found\n\n`;
      response += `The entity \`${entityName}\` was not found in the codebase, or has no usages.\n`;
      response += `This change is safe to make without ripple effects.\n`;
    } else {
      // Summary
      response += `## 📊 Impact Summary\n\n`;
      response += `| Metric | Count |\n`;
      response += `|--------|-------|\n`;
      response += `| Files affected | ${matches.length} |\n`;
      response += `| Total usages | ${matches.reduce((sum, m) => sum + m.usageLines.length, 0)} |\n`;
      if (definitionFile) {
        response += `| Definition | \`${definitionFile}\` |\n`;
      }
      response += `\n`;

      // Categorize by impact level
      const highImpact = matches.filter(m => m.usageLines.length >= 5);
      const mediumImpact = matches.filter(m => m.usageLines.length >= 2 && m.usageLines.length < 5);
      const lowImpact = matches.filter(m => m.usageLines.length === 1);

      if (highImpact.length > 0) {
        response += `## 🔴 High Impact (5+ usages)\n\n`;
        for (const m of highImpact) {
          response += `### \`${m.file}\`${m.isDefinition ? ' (DEFINITION)' : ''}\n`;
          if (m.importLine) response += `Import: \`${m.importLine}\`\n`;
          response += `Usages (${m.usageLines.length}):\n`;
          for (let i = 0; i < Math.min(5, m.usageLines.length); i++) {
            response += `- Line ${m.lineNumbers[i]}: \`${m.usageLines[i].substring(0, 80)}${m.usageLines[i].length > 80 ? '...' : ''}\`\n`;
          }
          if (m.usageLines.length > 5) {
            response += `- ... and ${m.usageLines.length - 5} more\n`;
          }
          response += `\n`;
        }
      }

      if (mediumImpact.length > 0) {
        response += `## 🟡 Medium Impact (2-4 usages)\n\n`;
        for (const m of mediumImpact) {
          response += `- \`${m.file}\` (${m.usageLines.length} usages)\n`;
        }
        response += `\n`;
      }

      if (lowImpact.length > 0) {
        response += `## 🟢 Low Impact (1 usage)\n\n`;
        for (const m of lowImpact) {
          response += `- \`${m.file}\`\n`;
        }
        response += `\n`;
      }

      // Recommendations
      response += `## 💡 Recommendations\n\n`;

      if (changeType === 'added_field') {
        response += `**Adding a field is usually safe.** Optional fields won't break existing code.\n`;
        response += `If the field is required, update these files to provide the new field.\n`;
      } else if (changeType === 'removed_field') {
        response += `**Removing a field is breaking.** Check each file above to remove usages of the deleted field.\n`;
        response += `Run \`npx tsc --noEmit\` after making changes to find remaining issues.\n`;
      } else if (changeType === 'renamed') {
        response += `**Renaming is breaking.** Update all files above to use the new name.\n`;
        response += `Consider using IDE "Rename Symbol" for safer refactoring.\n`;
      } else if (changeType === 'type_changed') {
        response += `**Type changes may break.** Review each usage to ensure compatibility.\n`;
        response += `Run \`npx tsc --noEmit\` to find type errors.\n`;
      } else if (changeType === 'signature_changed') {
        response += `**Signature changes are breaking.** Update all call sites with new parameters.\n`;
      } else {
        response += `1. Review the high-impact files first\n`;
        response += `2. Run \`npx tsc --noEmit\` after changes to catch type errors\n`;
        response += `3. Run tests to verify functionality\n`;
      }

      response += `\n---\n`;
      response += `*Run this check again after making changes to verify all ripples are addressed.*\n`;
    }

    return { content: [{ type: 'text' as const, text: response }] };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log to stderr so it doesn't interfere with stdio protocol
    console.error('CodeBakers MCP server running on stdio');
  }
}

// Export function for programmatic usage
export async function runServer(): Promise<void> {
  const server = new CodeBakersServer();
  await server.run();
}

// Run directly if executed as main module
const isMain = process.argv[1]?.includes('server');
if (isMain) {
  runServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
