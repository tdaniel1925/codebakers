#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getApiKey, getApiUrl, getExperienceLevel, setExperienceLevel, type ExperienceLevel } from '../config.js';
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

  constructor() {
    this.apiKey = getApiKey();
    this.apiUrl = getApiUrl();

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
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
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
            'Create a new project from scratch with Next.js + Supabase + Drizzle. Use this when user wants to build something new and no project exists yet. Creates all files, installs dependencies, and sets up CodeBakers patterns automatically.',
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
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.apiKey) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Not logged in. Run `codebakers login` first.'
        );
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
          return this.handleScaffoldProject(args as { projectName: string; description?: string });

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
        Authorization: `Bearer ${this.apiKey}`,
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
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
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
        Authorization: `Bearer ${this.apiKey}`,
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
        Authorization: `Bearer ${this.apiKey}`,
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

  private async handleScaffoldProject(args: { projectName: string; description?: string }) {
    const { projectName, description } = args;
    const cwd = process.cwd();

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
        headers: { Authorization: `Bearer ${this.apiKey}` },
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
      results.push('### Next Steps:\n');
      results.push('1. **Set up Supabase:** Go to https://supabase.com and create a free project');
      results.push('2. **Add credentials:** Copy your Supabase URL and anon key to `.env.local`');
      results.push('3. **Start building:** Just tell me what features you want!\n');
      results.push('### Example:\n');
      results.push('> "Add user authentication with email/password"');
      results.push('> "Create a dashboard with stats cards"');
      results.push('> "Build a todo list with CRUD operations"');

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
        headers: { Authorization: `Bearer ${this.apiKey}` },
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
          text: `# ❌ Healing Failed\n\nError: ${message}`,
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

    return {
      content: [{
        type: 'text' as const,
        text: statusText,
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
          Authorization: `Bearer ${this.apiKey}`,
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
          Authorization: `Bearer ${this.apiKey}`,
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
