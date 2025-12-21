#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getApiKey, getApiUrl } from '../config.js';
import * as fs from 'fs';
import * as path from 'path';

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

// Pattern detection keywords for auto-routing
const PATTERN_KEYWORDS: Record<string, string[]> = {
  '00-core': ['any', 'all', 'code', 'feature', 'build'],
  '01-database': ['database', 'db', 'query', 'schema', 'table', 'migration', 'drizzle', 'sql', 'postgres'],
  '02-auth': ['auth', 'login', 'signup', 'register', 'password', 'session', 'oauth', 'google', 'github', '2fa', 'permission', 'role'],
  '03-api': ['api', 'endpoint', 'route', 'rest', 'crud', 'webhook', 'rate limit'],
  '04-frontend': ['form', 'input', 'button', 'modal', 'component', 'react', 'ui', 'loading', 'skeleton', 'table', 'list'],
  '05-payments': ['stripe', 'payment', 'checkout', 'billing', 'subscription', 'invoice', 'pricing'],
  '06-integrations': ['email', 'resend', 'upload', 'file', 's3', 'sms', 'twilio', 'background job', 'inngest'],
  '07-performance': ['cache', 'redis', 'optimize', 'performance', 'slow', 'fast'],
  '08-testing': ['test', 'playwright', 'vitest', 'ci', 'deploy'],
  '09-design': ['design', 'css', 'tailwind', 'responsive', 'mobile', 'accessibility', 'dark mode', 'theme'],
  '14-ai': ['ai', 'llm', 'openai', 'anthropic', 'claude', 'gpt', 'chat', 'embedding', 'rag'],
  '27-search': ['search', 'filter', 'autocomplete', 'algolia', 'typesense'],
};

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
            'ALWAYS USE THIS FIRST for any coding request. Takes a simple user request, optimizes it into a production-ready prompt, detects relevant patterns, and returns everything needed to build the feature correctly. This ensures the user gets production-quality code on the first try.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              request: {
                type: 'string',
                description: 'The user\'s original request (e.g., "add login", "create checkout", "build search")',
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

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  private detectPatterns(request: string): string[] {
    const lowerRequest = request.toLowerCase();
    const detectedPatterns = new Set<string>();

    // Always include core
    detectedPatterns.add('00-core');

    // Check each pattern's keywords
    for (const [pattern, keywords] of Object.entries(PATTERN_KEYWORDS)) {
      if (pattern === '00-core') continue; // Already added

      for (const keyword of keywords) {
        if (lowerRequest.includes(keyword)) {
          detectedPatterns.add(pattern);
          break;
        }
      }
    }

    // Always include frontend for UI-related requests
    if (detectedPatterns.size > 1) {
      detectedPatterns.add('04-frontend');
    }

    return Array.from(detectedPatterns).slice(0, 5); // Max 5 patterns
  }

  private async handleOptimizeAndBuild(args: { request: string }) {
    const { request: userRequest } = args;

    // Step 1: Gather project context
    const context = this.gatherProjectContext();
    const contextSummary = this.formatContextForPrompt(context);

    // Step 2: Call API to optimize the prompt with context
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

    let optimizedPrompt = userRequest;
    let detectedFeature = 'Feature';

    if (optimizeResponse.ok) {
      const optimizeData = await optimizeResponse.json();
      optimizedPrompt = optimizeData.optimizedPrompt || userRequest;
      detectedFeature = optimizeData.featureName || 'Feature';
    }

    // Step 3: Detect relevant patterns
    const patterns = this.detectPatterns(userRequest);

    // Step 4: Fetch all relevant patterns
    const patternResult = await this.fetchPatterns(patterns);

    // Step 5: Build the response showing the optimization with context
    const patternContent = Object.entries(patternResult.patterns || {})
      .map(([name, text]) => `## ${name}\n\n${text}`)
      .join('\n\n---\n\n');

    const response = `# 🪄 Prompt Optimizer (Context-Aware)

## Your Request
"${userRequest}"

## Project Context Detected
${contextSummary}

## Optimized Prompt (Production-Ready)
${optimizedPrompt}

---

## Detected Feature: ${detectedFeature}

## Loaded Patterns: ${patterns.join(', ')}

---

# Pattern Documentation

${patternContent}

---

**IMPORTANT:** Use the optimized prompt above as your guide. It is tailored to THIS project's structure, existing components, and conventions. The prompt includes:
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
          text: `Available CodeBakers Patterns (${data.total} total):\n\n${patternList}\n\nTip: Always load "00-core" first for any coding task.`,
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
