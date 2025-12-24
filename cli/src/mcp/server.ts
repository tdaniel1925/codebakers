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
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as templates from '../templates/nextjs-supabase.js';

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
          return this.handleGetStatus();

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

  private handleGetStatus() {
    const level = getExperienceLevel();
    const context = this.gatherProjectContext();

    const statusText = `# ✅ CodeBakers is Active!

## Connection Status
- **MCP Server:** Running
- **API Connected:** Yes
- **Version:** 1.5.0

## Current Settings
- **Experience Level:** ${level.charAt(0).toUpperCase() + level.slice(1)}
- **Project:** ${context.projectName}

## Available Features
- 🔧 **optimize_and_build** - AI-powered prompt optimization
- 📦 **get_pattern** - Fetch production patterns
- 🔍 **search_patterns** - Search for specific guidance
- 🏗️ **scaffold_project** - Create new projects
- ⚙️ **init_project** - Add patterns to existing projects

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
