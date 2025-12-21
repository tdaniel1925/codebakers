'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cancel01Icon,
  Tick02Icon,
  ArrowRight02Icon,
  AiMagicIcon,
  Loading03Icon,
  Clock01Icon,
  Alert02Icon,
  ArrowReloadHorizontalIcon,
  SecurityCheckIcon,
  TestTube01Icon,
  CodeIcon,
  Copy01Icon,
  Tick01Icon,
} from 'hugeicons-react';

// Quick suggestion chips for common use cases
const suggestions = [
  'login form',
  'Stripe checkout',
  'REST API',
  'file upload',
  'dashboard',
];

// Simple metrics comparison for each feature type
type FeatureMetrics = {
  keywords: string[];
  featureName: string;
  optimizedPrompt: string;
  without: {
    prompts: string;
    errors: string;
    time: string;
    issues: string[];
  };
  with: {
    prompts: string;
    errors: string;
    time: string;
    includes: string[];
  };
};

const featureMetrics: Record<string, FeatureMetrics> = {
  form: {
    keywords: ['form', 'input', 'login', 'signup', 'register', 'contact', 'submit'],
    featureName: 'Login Form',
    optimizedPrompt: 'Build a login form with email and password fields using React Hook Form and Zod validation. Include: loading state on submit button, inline error messages for invalid input, toast notification for failed login attempts, forgot password link, optional "remember me" checkbox, redirect to dashboard on success. Use shadcn/ui Input and Button components. Make it fully accessible with ARIA labels and keyboard navigation. Add Playwright tests for happy path and error states.',
    without: {
      prompts: '8-12',
      errors: '5-7',
      time: '45-60 min',
      issues: [
        'Missing loading states',
        'No input validation',
        'No error messages',
        'Not accessible (a11y)',
        'No type safety',
      ],
    },
    with: {
      prompts: '1',
      errors: '0',
      time: '5 min',
      includes: [
        'Zod validation built-in',
        'Loading & error states',
        'ARIA accessible',
        'TypeScript types',
        'Toast notifications',
      ],
    },
  },
  payment: {
    keywords: ['stripe', 'payment', 'checkout', 'billing', 'subscription', 'pay'],
    featureName: 'Stripe Checkout',
    optimizedPrompt: 'Implement Stripe checkout with subscription support. Include: create checkout session API route with proper error handling, webhook endpoint for payment events (checkout.session.completed, invoice.paid, customer.subscription.updated), signature verification, idempotency keys for all Stripe calls, sync subscription status to database, handle failed payments gracefully, customer portal redirect for subscription management. Use server actions where appropriate. Add comprehensive error logging and Playwright tests.',
    without: {
      prompts: '15-20',
      errors: '8-12',
      time: '3-4 hours',
      issues: [
        'No webhook handling',
        'Missing error recovery',
        'Security vulnerabilities',
        'No idempotency',
        'Database not synced',
      ],
    },
    with: {
      prompts: '1',
      errors: '0',
      time: '15 min',
      includes: [
        'Webhook verification',
        'Idempotency keys',
        'Database sync',
        'Error recovery',
        'Security best practices',
      ],
    },
  },
  api: {
    keywords: ['api', 'endpoint', 'rest', 'crud', 'backend', 'route', 'server'],
    featureName: 'REST API Endpoint',
    optimizedPrompt: 'Create a REST API endpoint with full CRUD operations. Include: Zod schema validation for request body and query params, authentication middleware check, rate limiting (10 req/min for unauthenticated, 100 for authenticated), proper HTTP status codes (200, 201, 400, 401, 403, 404, 429, 500), consistent error response format with error codes, request ID for tracing, audit logging for mutations. Use Drizzle ORM with parameterized queries. Add OpenAPI documentation comments and integration tests.',
    without: {
      prompts: '6-10',
      errors: '4-6',
      time: '30-45 min',
      issues: [
        'No input validation',
        'Missing auth checks',
        'SQL injection risk',
        'No rate limiting',
        'Poor error responses',
      ],
    },
    with: {
      prompts: '1',
      errors: '0',
      time: '5 min',
      includes: [
        'Zod validation',
        'Auth middleware',
        'Parameterized queries',
        'Rate limiting',
        'Proper status codes',
      ],
    },
  },
  upload: {
    keywords: ['upload', 'file', 'image', 'photo', 's3', 'storage', 'media'],
    featureName: 'File Upload',
    optimizedPrompt: 'Build a file upload component with drag-and-drop support. Include: file type validation (images: jpg, png, webp; documents: pdf, docx), max file size limit (10MB), upload progress indicator, S3 presigned URL generation for secure direct uploads, image preview before upload, multiple file selection, cancel upload functionality, error handling with user-friendly messages, cleanup on component unmount. Use React Hook Form for form integration. Add tests for validation and upload flow.',
    without: {
      prompts: '10-15',
      errors: '6-8',
      time: '1-2 hours',
      issues: [
        'No file validation',
        'No size limits',
        'Security vulnerabilities',
        'No progress indicator',
        'No error handling',
      ],
    },
    with: {
      prompts: '1',
      errors: '0',
      time: '10 min',
      includes: [
        'File type validation',
        'Size limits enforced',
        'Progress tracking',
        'S3 presigned URLs',
        'Secure by default',
      ],
    },
  },
  dashboard: {
    keywords: ['dashboard', 'admin', 'panel', 'analytics', 'stats', 'overview'],
    featureName: 'Dashboard',
    optimizedPrompt: 'Build an analytics dashboard with real-time data. Include: React Query for data fetching with 30-second auto-refresh, skeleton loaders during initial load, error boundaries with retry button, responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop), stat cards with trend indicators, date range picker for filtering, export to CSV functionality. Use Recharts for visualizations. Implement optimistic updates where applicable. Add loading and error state tests.',
    without: {
      prompts: '8-12',
      errors: '5-7',
      time: '1-2 hours',
      issues: [
        'No loading states',
        'No error handling',
        'Missing skeleton UI',
        'No data caching',
        'Manual refresh only',
      ],
    },
    with: {
      prompts: '1',
      errors: '0',
      time: '10 min',
      includes: [
        'React Query caching',
        'Skeleton loaders',
        'Error boundaries',
        'Auto-refresh',
        'Optimistic updates',
      ],
    },
  },
  search: {
    keywords: ['search', 'filter', 'find', 'query', 'autocomplete'],
    featureName: 'Search Bar',
    optimizedPrompt: 'Build a search component with autocomplete. Include: 300ms debounced input to prevent API flooding, loading spinner during search, empty state with helpful message, keyboard navigation (arrow keys, enter to select, escape to close), highlight matching text in results, recent searches stored in localStorage, clear button when input has value, responsive dropdown positioning. Use ARIA combobox pattern for accessibility. Add Playwright tests for keyboard navigation and search flow.',
    without: {
      prompts: '6-10',
      errors: '4-5',
      time: '30-45 min',
      issues: [
        'No debouncing',
        'API flood on every keystroke',
        'No loading indicator',
        'Missing empty state',
        'No keyboard nav',
      ],
    },
    with: {
      prompts: '1',
      errors: '0',
      time: '5 min',
      includes: [
        'Debounced input',
        'Loading indicator',
        'Empty state UI',
        'Keyboard navigation',
        'ARIA accessible',
      ],
    },
  },
};

// Default metrics for unrecognized features
const defaultMetrics: FeatureMetrics = {
  keywords: [],
  featureName: 'Feature',
  optimizedPrompt: 'Build this feature with production-ready patterns. Include: comprehensive error handling with user-friendly messages, loading and skeleton states, Zod validation for all inputs, TypeScript types throughout, proper authentication checks, audit logging for important actions, responsive design, accessibility (ARIA labels, keyboard navigation), and Playwright tests for critical paths. Follow the established codebase conventions and use existing UI components.',
  without: {
    prompts: '8-15',
    errors: '5-10',
    time: '1-2 hours',
    issues: [
      'Missing error handling',
      'No loading states',
      'No validation',
      'Poor UX patterns',
      'Security gaps',
    ],
  },
  with: {
    prompts: '1',
    errors: '0',
    time: '5-10 min',
    includes: [
      'Full error handling',
      'Loading states',
      'Type safety',
      'Production patterns',
      'Security built-in',
    ],
  },
};

function findMetrics(input: string): FeatureMetrics {
  const lowerInput = input.toLowerCase();
  for (const [, metrics] of Object.entries(featureMetrics)) {
    if (metrics.keywords.some(keyword => lowerInput.includes(keyword))) {
      return metrics;
    }
  }
  return defaultMetrics;
}

export function InteractiveDemo() {
  const [userInput, setUserInput] = useState('');
  const [displayedInput, setDisplayedInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<FeatureMetrics | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    if (currentMetrics) {
      await navigator.clipboard.writeText(currentMetrics.optimizedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) return;

    setIsGenerating(true);
    setShowResult(false);

    // Simulate AI "thinking" time
    await new Promise(resolve => setTimeout(resolve, 800));

    const metrics = findMetrics(userInput);
    setCurrentMetrics(metrics);
    setDisplayedInput(userInput);
    setIsGenerating(false);
    setShowResult(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
    // Auto-generate after selecting a suggestion
    setTimeout(() => {
      setIsGenerating(true);
      setShowResult(false);
      setTimeout(() => {
        const metrics = findMetrics(suggestion);
        setCurrentMetrics(metrics);
        setDisplayedInput(suggestion);
        setIsGenerating(false);
        setShowResult(true);
      }, 600);
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge className="mb-4 bg-amber-50 text-amber-600 border-amber-200 px-4 py-1">
          <AiMagicIcon className="h-3 w-3 mr-2" />
          Try It Yourself
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          What do you want to&nbsp;build?
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Type any feature and see exactly how much time and frustration you&apos;ll save.
        </p>
      </div>

      {/* Input area */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., login form with email and password..."
            className="w-full h-14 px-5 pr-32 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-lg"
            disabled={isGenerating}
          />
          <Button
            onClick={handleGenerate}
            disabled={!userInput.trim() || isGenerating}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-700 text-white shadow-md"
          >
            {isGenerating ? (
              <>
                <Loading03Icon className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <AiMagicIcon className="mr-2 h-4 w-4" />
                Compare
              </>
            )}
          </Button>
        </div>

        {/* Quick suggestions */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="text-sm text-gray-500 mr-2">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isGenerating}
              className="px-3 py-1 text-sm rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-red-300 text-gray-600 hover:text-gray-900 transition-all disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-red-100 animate-pulse" />
            <Loading03Icon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-red-500 animate-spin" />
          </div>
          <p className="mt-4 text-muted-foreground animate-pulse">Analyzing your request...</p>
        </div>
      )}

      {/* Results - Simple metrics comparison */}
      {showResult && currentMetrics && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Prompt Optimization Section */}
          <div className="mb-10 max-w-3xl mx-auto">
            <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
              <div className="px-5 py-3 bg-amber-100/50 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AiMagicIcon className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-amber-800">Prompt Optimizer</span>
                </div>
                <Badge className="bg-amber-200 text-amber-800 border-amber-300">Auto-Enhanced</Badge>
              </div>
              <div className="p-5">
                {/* Before */}
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">You typed:</div>
                  <div className="px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-600 italic">
                    &quot;{displayedInput}&quot;
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center my-3">
                  <div className="flex items-center gap-2 text-amber-600">
                    <div className="h-px w-8 bg-amber-300" />
                    <AiMagicIcon className="h-5 w-5" />
                    <div className="h-px w-8 bg-amber-300" />
                  </div>
                </div>

                {/* After */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Optimized prompt:</div>
                  <div className="px-4 py-3 rounded-lg bg-white border-2 border-green-200 text-gray-800 text-sm leading-relaxed">
                    {currentMetrics.optimizedPrompt}
                  </div>
                </div>

                {/* Copy button */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-amber-700">
                    This prompt triggers all relevant patterns for maximum output quality.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPrompt}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    {copied ? (
                      <>
                        <Tick01Icon className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy01Icon className="h-4 w-4 mr-1" />
                        Copy Prompt
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Feature name badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200">
              <span className="text-gray-500 text-sm">Building:</span>
              <span className="text-gray-900 font-semibold">{currentMetrics.featureName}</span>
            </div>
          </div>

          {/* Big stats comparison */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Prompts needed */}
            <div className="text-center p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <ArrowReloadHorizontalIcon className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <div className="text-sm text-gray-500 mb-2">Prompts Needed</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-red-500">{currentMetrics.without.prompts}</div>
                  <div className="text-xs text-gray-500">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-gray-300" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentMetrics.with.prompts}</div>
                  <div className="text-xs text-gray-500">With CodeBakers</div>
                </div>
              </div>
            </div>

            {/* Errors to fix */}
            <div className="text-center p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <Alert02Icon className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <div className="text-sm text-gray-500 mb-2">Errors to Fix</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-red-500">{currentMetrics.without.errors}</div>
                  <div className="text-xs text-gray-500">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-gray-300" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentMetrics.with.errors}</div>
                  <div className="text-xs text-gray-500">With CodeBakers</div>
                </div>
              </div>
            </div>

            {/* Time spent */}
            <div className="text-center p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <Clock01Icon className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <div className="text-sm text-gray-500 mb-2">Time Spent</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-red-500">{currentMetrics.without.time}</div>
                  <div className="text-xs text-gray-500">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-gray-300" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentMetrics.with.time}</div>
                  <div className="text-xs text-gray-500">With CodeBakers</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed comparison cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Without CodeBakers */}
            <div className="rounded-2xl border-2 border-red-100 overflow-hidden bg-white">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <Cancel01Icon className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-700">Without CodeBakers</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-500 mb-4">What you&apos;ll be fixing:</p>
                <ul className="space-y-2">
                  {currentMetrics.without.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Cancel01Icon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* With CodeBakers */}
            <div className="rounded-2xl border-2 border-green-100 overflow-hidden bg-white">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                <Tick02Icon className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-700">With CodeBakers</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-500 mb-4">What&apos;s included automatically:</p>
                <ul className="space-y-2">
                  {currentMetrics.with.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bonus row */}
          <div className="grid grid-cols-3 gap-4 mb-8 text-center">
            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
              <SecurityCheckIcon className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-medium text-green-700">Security Built-in</div>
            </div>
            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
              <TestTube01Icon className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-medium text-green-700">Tests Included</div>
            </div>
            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
              <CodeIcon className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-medium text-green-700">TypeScript Types</div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="text-center">
            <p className="text-gray-500 mb-4">
              Get production-ready code from <span className="text-gray-900 font-semibold">every prompt</span>.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
                asChild
              >
                <Link href="/signup">
                  Start Building Better
                  <ArrowRight02Icon className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                asChild
              >
                <Link href="#code-comparison">
                  See Code Examples
                  <ArrowRight02Icon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Initial state - before any generation */}
      {!showResult && !isGenerating && (
        <div className="text-center py-12 text-muted-foreground">
          <AiMagicIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p>Type a feature above and click Compare to see the difference</p>
        </div>
      )}
    </div>
  );
}
