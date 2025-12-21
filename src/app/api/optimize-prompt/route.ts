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

const SYSTEM_PROMPT = `You are a prompt optimization expert for CodeBakers, a production-ready code patterns system.

Your job is to take a simple, casual developer request and expand it into a comprehensive, production-ready prompt that will result in high-quality code.

Rules:
1. Keep the optimized prompt under 300 words
2. Include specific technical requirements (error handling, loading states, validation, accessibility, tests)
3. Reference appropriate technologies (React Hook Form, Zod, shadcn/ui, Playwright, etc.)
4. Be specific about edge cases and error scenarios
5. Include testing requirements
6. Maintain the original intent while adding production requirements

Output ONLY the optimized prompt, no explanations or preamble.`;

/**
 * POST /api/optimize-prompt
 * Optimizes a simple prompt into a production-ready one using AI
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Validate API key
    const validation = await validateRequest(req);
    if (validation.error) return validation.error;

    const body = await req.json();
    const { prompt } = body;

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
        optimizedPrompt: getTemplateOptimization(prompt, featureName),
        featureName,
        method: 'template',
      });
    }

    // Use Anthropic to optimize the prompt
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Optimize this developer request into a production-ready prompt:\n\n"${prompt}"`,
        },
      ],
    });

    const optimizedPrompt = message.content[0].type === 'text'
      ? message.content[0].text
      : getTemplateOptimization(prompt, featureName);

    return NextResponse.json({
      optimizedPrompt,
      featureName,
      method: 'ai',
    });

  } catch (error) {
    console.error('Prompt optimization error:', error);
    return handleApiError(error);
  }
}

function getTemplateOptimization(prompt: string, featureName: string): string {
  const templates: Record<string, string> = {
    'Authentication': `Build a complete authentication system based on the request: "${prompt}". Include: email and password fields using React Hook Form and Zod validation, loading state on submit button, inline error messages for invalid input, toast notification for failed attempts, forgot password link, optional "remember me" checkbox, redirect on success. Use shadcn/ui Input and Button components. Make it fully accessible with ARIA labels and keyboard navigation. Add Playwright tests for happy path and error states.`,

    'Form': `Build a form based on the request: "${prompt}". Include: React Hook Form with Zod schema validation, loading state on submit, inline error messages, toast notifications for success/failure, proper TypeScript types, disabled state while submitting. Use shadcn/ui form components. Make it accessible with proper labels and ARIA attributes. Add Playwright tests.`,

    'Payment': `Implement payment functionality for: "${prompt}". Include: Stripe checkout session API route with proper error handling, webhook endpoint for payment events (checkout.session.completed, invoice.paid), signature verification, idempotency keys, sync subscription status to database, handle failed payments gracefully, customer portal redirect. Add comprehensive error logging and Playwright tests.`,

    'API Endpoint': `Create an API endpoint for: "${prompt}". Include: Zod schema validation for request body and query params, authentication middleware check, rate limiting, proper HTTP status codes (200, 201, 400, 401, 403, 404, 429, 500), consistent error response format with error codes, request ID for tracing, audit logging for mutations. Use Drizzle ORM with parameterized queries. Add OpenAPI documentation comments and integration tests.`,

    'File Upload': `Build file upload functionality for: "${prompt}". Include: file type validation, max file size limit (10MB), upload progress indicator, presigned URL generation for secure uploads, preview before upload, multiple file selection, cancel functionality, error handling with user-friendly messages. Use React Hook Form for integration. Add tests for validation and upload flow.`,

    'Dashboard': `Build a dashboard for: "${prompt}". Include: React Query for data fetching with auto-refresh, skeleton loaders during initial load, error boundaries with retry button, responsive grid layout, stat cards with trend indicators, date range picker for filtering, export to CSV functionality. Implement optimistic updates where applicable. Add loading and error state tests.`,

    'Search': `Build search functionality for: "${prompt}". Include: debounced input to prevent API flooding, loading spinner during search, empty state with helpful message, keyboard navigation (arrow keys, enter, escape), highlight matching text in results, recent searches in localStorage, clear button. Use ARIA combobox pattern for accessibility. Add Playwright tests for keyboard navigation.`,

    'Database': `Implement database operations for: "${prompt}". Include: Drizzle ORM schema with proper types, parameterized queries to prevent SQL injection, proper indexing for performance, soft delete pattern if applicable, audit logging for mutations, transaction support for multi-table operations. Add migration files and tests.`,

    'Email': `Implement email functionality for: "${prompt}". Include: Resend integration with proper error handling, HTML email templates with React Email, plain text fallback, unsubscribe link where applicable, rate limiting, queue for bulk sends, bounce handling. Add tests for template rendering and send flow.`,

    'AI Integration': `Build AI integration for: "${prompt}". Include: streaming response support, proper error handling for API failures, rate limiting, token counting and cost tracking, retry logic with exponential backoff, user-friendly error messages, loading states. Consider caching for repeated queries. Add tests for happy path and error scenarios.`,
  };

  return templates[featureName] || `Build this feature based on the request: "${prompt}". Include: comprehensive error handling with user-friendly messages, loading and skeleton states, Zod validation for all inputs, TypeScript types throughout, proper authentication checks, audit logging for important actions, responsive design, accessibility (ARIA labels, keyboard navigation), and Playwright tests for critical paths. Follow established codebase conventions and use existing UI components.`;
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
