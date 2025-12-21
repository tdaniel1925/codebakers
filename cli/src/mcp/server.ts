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

// Pattern cache to avoid repeated API calls
const patternCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    // Step 1: Call API to optimize the prompt
    const optimizeResponse = await fetch(`${this.apiUrl}/api/optimize-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ prompt: userRequest }),
    });

    let optimizedPrompt = userRequest;
    let detectedFeature = 'Feature';

    if (optimizeResponse.ok) {
      const optimizeData = await optimizeResponse.json();
      optimizedPrompt = optimizeData.optimizedPrompt || userRequest;
      detectedFeature = optimizeData.featureName || 'Feature';
    }

    // Step 2: Detect relevant patterns
    const patterns = this.detectPatterns(userRequest);

    // Step 3: Fetch all relevant patterns
    const patternResult = await this.fetchPatterns(patterns);

    // Step 4: Build the response showing the optimization
    const patternContent = Object.entries(patternResult.patterns || {})
      .map(([name, text]) => `## ${name}\n\n${text}`)
      .join('\n\n---\n\n');

    const response = `# 🪄 Prompt Optimizer

## Your Request
"${userRequest}"

## Optimized Prompt (Production-Ready)
${optimizedPrompt}

---

## Detected Feature: ${detectedFeature}

## Loaded Patterns: ${patterns.join(', ')}

---

# Pattern Documentation

${patternContent}

---

**IMPORTANT:** Use the optimized prompt above as your guide. It includes all the production requirements (error handling, loading states, validation, tests, etc.) that you should implement.

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
