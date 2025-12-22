import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ApiKeyService } from '@/services/api-key-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Available feature types for classification
const FEATURE_TYPES = [
  'Authentication',
  'Form',
  'Payment',
  'API Endpoint',
  'File Upload',
  'Dashboard',
  'Search',
  'Database',
  'Email',
  'AI Integration',
  'Animation',
  'Image Gallery',
  'Notifications',
  'Comments',
  'Settings',
  'Landing Page',
  'Data Table',
  'Modal/Dialog',
  'Navigation',
  'Charts/Visualization',
  'Feature', // Generic fallback
] as const;

// Available pattern modules
const PATTERN_MODULES = [
  '00-core',
  '01-database',
  '02-auth',
  '03-api',
  '04-frontend',
  '05-payments',
  '06-integrations',
  '07-performance',
  '08-testing',
  '09-design',
  '10-generators',
  '11-realtime',
  '12-saas',
  '13-mobile',
  '14-ai',
  '26-analytics',
  '27-search',
  '28-email-design',
  '29-data-viz',
  '30-motion',
  '31-iconography',
  '32-print',
] as const;

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

// AI response structure
interface AIAnalysis {
  optimizedPrompt: string;
  featureName: string;
  patterns: string[];
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

Your job is to:
1. Analyze the developer's request to understand their TRUE INTENT (not just keywords)
2. Classify the feature type based on what they're actually trying to build
3. Select the relevant pattern modules that would help
4. Expand the request into a comprehensive, production-ready prompt
${contextSection}
AVAILABLE FEATURE TYPES:
${FEATURE_TYPES.join(', ')}

AVAILABLE PATTERN MODULES:
${PATTERN_MODULES.join(', ')}

PATTERN MODULE PURPOSES:
- 00-core: Always include. Core standards, TypeScript, error handling
- 01-database: Database schemas, queries, migrations, Drizzle ORM
- 02-auth: Login, signup, sessions, OAuth, 2FA, permissions
- 03-api: REST endpoints, validation, rate limiting, webhooks
- 04-frontend: React components, forms, modals, tables, state
- 05-payments: Stripe, subscriptions, billing, invoices
- 06-integrations: Email, SMS, file upload, background jobs
- 07-performance: Caching, optimization, lazy loading
- 08-testing: Unit tests, E2E tests, CI/CD
- 09-design: UI/UX, accessibility, responsive design, SEO
- 10-generators: Scaffolding, boilerplate, project setup
- 11-realtime: WebSockets, notifications, live updates
- 12-saas: Multi-tenant, teams, feature flags
- 13-mobile: React Native, Expo, mobile-specific
- 14-ai: LLM integration, embeddings, RAG, streaming
- 26-analytics: Tracking, metrics, funnels, dashboards
- 27-search: Full-text search, autocomplete, filters
- 28-email-design: HTML email templates, MJML
- 29-data-viz: Charts, graphs, data visualization
- 30-motion: Animations, transitions, Framer Motion
- 31-iconography: Icons, SVG, icon systems
- 32-print: PDF generation, print stylesheets

INTENT ANALYSIS RULES:
- "zoom animation on image" → Animation (NOT File Upload just because "image" is mentioned)
- "upload profile picture" → File Upload
- "image gallery" → Image Gallery
- "login form" → Authentication (NOT just Form)
- "payment checkout" → Payment
- Focus on the PRIMARY ACTION/INTENT, not incidental words

RESPONSE FORMAT:
You MUST respond with valid JSON only, no markdown, no explanation:
{
  "optimizedPrompt": "The expanded production-ready prompt (under 300 words)",
  "featureName": "One of the feature types listed above",
  "patterns": ["00-core", "plus 1-4 other relevant patterns"]
}

Rules for optimized prompt:
1. Keep under 300 words
2. Include error handling, loading states, validation, accessibility, tests
3. Reference specific components/services from project context when available
4. Be specific about edge cases
5. Always include testing requirements`;
}

/**
 * POST /api/optimize-prompt
 * Optimizes a simple prompt into a production-ready one using AI
 * AI analyzes intent to determine feature type and relevant patterns (no keyword matching)
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Check for demo mode (public demo on homepage)
    const authHeader = req.headers.get('authorization');
    const isDemo = authHeader === 'Bearer demo';

    if (!isDemo) {
      // Validate API key for non-demo requests
      const validation = await validateRequest(req);
      if (validation.error) return validation.error;
    }

    const body = await req.json();
    const { prompt, context } = body as { prompt: string; context?: ProjectContext };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    // Check if we have Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      // Fallback to template-based optimization (no AI available)
      return NextResponse.json({
        optimizedPrompt: getTemplateOptimization(prompt, context),
        featureName: 'Feature',
        patterns: ['00-core', '04-frontend'],
        method: 'template',
        hasContext: !!context,
      });
    }

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(context);

    // Use Anthropic to analyze intent and optimize the prompt
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this developer request and respond with JSON:\n\n"${prompt}"`,
        },
      ],
    });

    // Parse AI response
    let analysis: AIAnalysis;
    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      // Clean up any markdown formatting the AI might have added
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanJson);

      // Ensure patterns always includes 00-core
      if (!analysis.patterns.includes('00-core')) {
        analysis.patterns.unshift('00-core');
      }

      // Limit to max 5 patterns
      analysis.patterns = analysis.patterns.slice(0, 5);
    } catch {
      // If JSON parsing fails, fallback to template
      return NextResponse.json({
        optimizedPrompt: getTemplateOptimization(prompt, context),
        featureName: 'Feature',
        patterns: ['00-core', '04-frontend'],
        method: 'template-fallback',
        hasContext: !!context,
      });
    }

    return NextResponse.json({
      optimizedPrompt: analysis.optimizedPrompt,
      featureName: analysis.featureName,
      patterns: analysis.patterns,
      method: 'ai',
      hasContext: !!context,
    });

  } catch (error) {
    console.error('Prompt optimization error:', error);
    return handleApiError(error);
  }
}

function getTemplateOptimization(prompt: string, context?: ProjectContext): string {
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

  // Generic template when AI is not available
  return `Build this feature based on the request: "${prompt}". Include: comprehensive error handling with user-friendly messages, loading and skeleton states, Zod validation for all inputs, TypeScript types throughout, proper authentication checks where needed, responsive design, accessibility (ARIA labels, keyboard navigation), and Playwright tests for critical paths.${contextAdditions} Follow established codebase conventions and use existing UI components.`;
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

  // Check access - no project ID for this endpoint (backwards compatible)
  const accessCheck = TeamService.canAccessProject(team, null);

  if (!accessCheck.allowed) {
    return {
      error: NextResponse.json(
        { error: accessCheck.reason, code: accessCheck.code },
        { status: 403 }
      ),
    };
  }

  return { team };
}
