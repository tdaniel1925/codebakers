import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ApiKeyService } from '@/services/api-key-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Feature detection keywords
const FEATURE_KEYWORDS: Record<string, { name: string; keywords: string[] }> = {
  auth: {
    name: 'Authentication',
    keywords: ['auth', 'login', 'signup', 'register', 'password', 'session', 'oauth', '2fa'],
  },
  form: {
    name: 'Form',
    keywords: ['form', 'input', 'field', 'submit', 'validation'],
  },
  payment: {
    name: 'Payment',
    keywords: ['stripe', 'payment', 'checkout', 'billing', 'subscription', 'invoice'],
  },
  api: {
    name: 'API Endpoint',
    keywords: ['api', 'endpoint', 'route', 'rest', 'crud', 'backend'],
  },
  upload: {
    name: 'File Upload',
    keywords: ['upload', 'file', 'image', 'photo', 's3', 'storage'],
  },
  dashboard: {
    name: 'Dashboard',
    keywords: ['dashboard', 'admin', 'panel', 'analytics', 'stats'],
  },
  search: {
    name: 'Search',
    keywords: ['search', 'filter', 'find', 'autocomplete', 'query'],
  },
  database: {
    name: 'Database',
    keywords: ['database', 'db', 'schema', 'table', 'query', 'migration'],
  },
  email: {
    name: 'Email',
    keywords: ['email', 'send', 'notification', 'resend', 'newsletter'],
  },
  ai: {
    name: 'AI Integration',
    keywords: ['ai', 'llm', 'openai', 'claude', 'gpt', 'chat', 'embedding'],
  },
};

function detectFeature(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  for (const [, feature] of Object.entries(FEATURE_KEYWORDS)) {
    for (const keyword of feature.keywords) {
      if (lowerPrompt.includes(keyword)) {
        return feature.name;
      }
    }
  }

  return 'Feature';
}

// Project context type from MCP server
interface ProjectContext {
  summary: string;
  projectName: string;
  uiLibrary: string | null;
  schemaPath: string | null;
  componentsPath: string | null;
  existingComponents: string[];
  existingServices: string[];
  existingApiRoutes: string[];
  hasAuth: boolean;
  hasDatabase: boolean;
  hasPayments: boolean;
  dependencies: string[];
}

function buildSystemPrompt(context?: ProjectContext): string {
  let contextSection = '';

  if (context) {
    const contextParts: string[] = [];

    if (context.projectName && context.projectName !== 'Unknown') {
      contextParts.push(`Project: ${context.projectName}`);
    }

    if (context.uiLibrary) {
      contextParts.push(`UI Library: ${context.uiLibrary} - ALWAYS use existing UI components from this library`);
    }

    if (context.componentsPath && context.existingComponents.length > 0) {
      contextParts.push(`Existing Components (${context.componentsPath}): ${context.existingComponents.slice(0, 15).join(', ')}`);
      contextParts.push(`IMPORTANT: Reuse these existing components instead of creating new ones`);
    }

    if (context.existingServices.length > 0) {
      contextParts.push(`Existing Services: ${context.existingServices.join(', ')}`);
      contextParts.push(`Use these existing services where applicable`);
    }

    if (context.schemaPath) {
      contextParts.push(`Database Schema Location: ${context.schemaPath}`);
    }

    if (context.existingApiRoutes.length > 0) {
      contextParts.push(`Existing API Routes: ${context.existingApiRoutes.slice(0, 10).join(', ')}`);
    }

    if (contextParts.length > 0) {
      contextSection = `\n\nPROJECT CONTEXT (use this to tailor your optimization):\n${contextParts.join('\n')}\n`;
    }
  }

  return `You are a prompt optimization expert for CodeBakers, a production-ready code patterns system.

Your job is to take a simple, casual developer request and expand it into a comprehensive, production-ready prompt that will result in high-quality code.
${contextSection}
Rules:
1. Keep the optimized prompt under 300 words
2. Include specific technical requirements (error handling, loading states, validation, accessibility, tests)
3. Reference the SPECIFIC components, services, and file paths from the project context when available
4. Be specific about edge cases and error scenarios
5. Include testing requirements
6. If the project has existing components (Button, Input, Card, etc.), explicitly mention to use them
7. If a schema path exists, mention where to add database changes
8. Maintain the original intent while adding production requirements

Output ONLY the optimized prompt, no explanations or preamble.`;
}

/**
 * POST /api/optimize-prompt
 * Optimizes a simple prompt into a production-ready one using AI
 * Accepts optional project context for context-aware optimization
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Validate API key
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    const body = await req.json();
    const { prompt, context } = body as { prompt: string; context?: ProjectContext };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    // Detect feature type
    const featureName = detectFeature(prompt);

    // Check if we have Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      // Fallback to template-based optimization
      return NextResponse.json({
        optimizedPrompt: getTemplateOptimization(prompt, featureName, context),
        featureName,
        method: 'template',
        hasContext: !!context,
      });
    }

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(context);

    // Use Anthropic to optimize the prompt
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Optimize this developer request into a production-ready prompt:\n\n"${prompt}"`,
        },
      ],
    });

    const optimizedPrompt = message.content[0].type === 'text'
      ? message.content[0].text
      : getTemplateOptimization(prompt, featureName, context);

    return NextResponse.json({
      optimizedPrompt,
      featureName,
      method: 'ai',
      hasContext: !!context,
    });

  } catch (error) {
    console.error('Prompt optimization error:', error);
    return handleApiError(error);
  }
}

function getTemplateOptimization(prompt: string, featureName: string, context?: ProjectContext): string {
  // Build context-aware additions
  let contextAdditions = '';

  if (context) {
    const parts: string[] = [];

    if (context.uiLibrary) {
      parts.push(`Use ${context.uiLibrary} components`);
    }

    if (context.componentsPath && context.existingComponents.length > 0) {
      const relevantComponents = context.existingComponents
        .filter(c => c.toLowerCase().includes('button') || c.toLowerCase().includes('input') || c.toLowerCase().includes('form') || c.toLowerCase().includes('card'))
        .slice(0, 5);
      if (relevantComponents.length > 0) {
        parts.push(`Reuse existing components from ${context.componentsPath}: ${relevantComponents.join(', ')}`);
      }
    }

    if (context.schemaPath) {
      parts.push(`Add any database changes to ${context.schemaPath}`);
    }

    if (context.existingServices.length > 0) {
      parts.push(`Use existing services where applicable: ${context.existingServices.slice(0, 5).join(', ')}`);
    }

    if (parts.length > 0) {
      contextAdditions = ' ' + parts.join('. ') + '.';
    }
  }

  const templates: Record<string, string> = {
    'Authentication': `Build a complete authentication system based on the request: "${prompt}". Include: email and password fields using React Hook Form and Zod validation, loading state on submit button, inline error messages for invalid input, toast notification for failed attempts, forgot password link, optional "remember me" checkbox, redirect on success.${contextAdditions} Make it fully accessible with ARIA labels and keyboard navigation. Add Playwright tests for happy path and error states.`,

    'Form': `Build a form based on the request: "${prompt}". Include: React Hook Form with Zod schema validation, loading state on submit, inline error messages, toast notifications for success/failure, proper TypeScript types, disabled state while submitting.${contextAdditions} Make it accessible with proper labels and ARIA attributes. Add Playwright tests.`,

    'Payment': `Implement payment functionality for: "${prompt}". Include: Stripe checkout session API route with proper error handling, webhook endpoint for payment events (checkout.session.completed, invoice.paid), signature verification, idempotency keys, sync subscription status to database, handle failed payments gracefully, customer portal redirect.${contextAdditions} Add comprehensive error logging and Playwright tests.`,

    'API Endpoint': `Create an API endpoint for: "${prompt}". Include: Zod schema validation for request body and query params, authentication middleware check, rate limiting, proper HTTP status codes (200, 201, 400, 401, 403, 404, 429, 500), consistent error response format with error codes, request ID for tracing, audit logging for mutations.${contextAdditions} Use Drizzle ORM with parameterized queries. Add OpenAPI documentation comments and integration tests.`,

    'File Upload': `Build file upload functionality for: "${prompt}". Include: file type validation, max file size limit (10MB), upload progress indicator, presigned URL generation for secure uploads, preview before upload, multiple file selection, cancel functionality, error handling with user-friendly messages.${contextAdditions} Use React Hook Form for integration. Add tests for validation and upload flow.`,

    'Dashboard': `Build a dashboard for: "${prompt}". Include: React Query for data fetching with auto-refresh, skeleton loaders during initial load, error boundaries with retry button, responsive grid layout, stat cards with trend indicators, date range picker for filtering, export to CSV functionality.${contextAdditions} Implement optimistic updates where applicable. Add loading and error state tests.`,

    'Search': `Build search functionality for: "${prompt}". Include: debounced input to prevent API flooding, loading spinner during search, empty state with helpful message, keyboard navigation (arrow keys, enter, escape), highlight matching text in results, recent searches in localStorage, clear button.${contextAdditions} Use ARIA combobox pattern for accessibility. Add Playwright tests for keyboard navigation.`,

    'Database': `Implement database operations for: "${prompt}". Include: Drizzle ORM schema with proper types, parameterized queries to prevent SQL injection, proper indexing for performance, soft delete pattern if applicable, audit logging for mutations, transaction support for multi-table operations.${contextAdditions} Add migration files and tests.`,

    'Email': `Implement email functionality for: "${prompt}". Include: Resend integration with proper error handling, HTML email templates with React Email, plain text fallback, unsubscribe link where applicable, rate limiting, queue for bulk sends, bounce handling.${contextAdditions} Add tests for template rendering and send flow.`,

    'AI Integration': `Build AI integration for: "${prompt}". Include: streaming response support, proper error handling for API failures, rate limiting, token counting and cost tracking, retry logic with exponential backoff, user-friendly error messages, loading states.${contextAdditions} Consider caching for repeated queries. Add tests for happy path and error scenarios.`,
  };

  return templates[featureName] || `Build this feature based on the request: "${prompt}". Include: comprehensive error handling with user-friendly messages, loading and skeleton states, Zod validation for all inputs, TypeScript types throughout, proper authentication checks, audit logging for important actions, responsive design, accessibility (ARIA labels, keyboard navigation), and Playwright tests for critical paths.${contextAdditions} Follow established codebase conventions and use existing UI components.`;
}

async function validateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
    };
  }

  const apiKey = authHeader.slice(7);
  const validation = await ApiKeyService.validate(apiKey);

  if (!validation.valid || !validation.team) {
    return {
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    };
  }

  const { team } = validation;
  const downloadCheck = TeamService.canDownload(team);

  if (!downloadCheck.allowed) {
    return {
      error: NextResponse.json(
        { error: downloadCheck.reason, code: downloadCheck.code },
        { status: 403 }
      ),
    };
  }

  return { team };
}
