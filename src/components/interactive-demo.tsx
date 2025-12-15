'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cancel01Icon,
  Tick02Icon,
  ArrowRight02Icon,
  AiBrain02Icon,
  AiMagicIcon,
  Loading03Icon,
  Clock01Icon,
  Alert02Icon,
  ArrowReloadHorizontalIcon,
  SecurityCheckIcon,
  TestTube01Icon,
  CodeIcon,
} from 'hugeicons-react';

// Quick suggestion chips for common use cases
const suggestions = [
  'login form',
  'Stripe checkout',
  'REST API',
  'file upload',
  'dashboard',
  'contact form',
];

// Simple metrics comparison for each feature type
type FeatureMetrics = {
  keywords: string[];
  featureName: string;
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
        <Badge className="mb-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 px-4 py-1">
          <AiBrain02Icon className="h-3 w-3 mr-2" />
          Try It Yourself
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          What do you want to build?
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
            className="w-full h-14 px-5 pr-32 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
            disabled={isGenerating}
          />
          <Button
            onClick={handleGenerate}
            disabled={!userInput.trim() || isGenerating}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md"
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
          <span className="text-sm text-muted-foreground mr-2">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isGenerating}
              className="px-3 py-1 text-sm rounded-full border border-border bg-muted/50 hover:bg-muted hover:border-blue-400 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
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
            <div className="w-16 h-16 rounded-full border-4 border-blue-200 dark:border-blue-900 animate-pulse" />
            <AiBrain02Icon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-500 animate-pulse" />
          </div>
          <p className="mt-4 text-muted-foreground animate-pulse">Analyzing your request...</p>
        </div>
      )}

      {/* Results - Simple metrics comparison */}
      {showResult && currentMetrics && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Prompt display */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border">
              <span className="text-muted-foreground text-sm">Building:</span>
              <span className="text-foreground font-semibold">{currentMetrics.featureName}</span>
              <span className="text-muted-foreground text-sm">from &quot;{displayedInput}&quot;</span>
            </div>
          </div>

          {/* Big stats comparison */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Prompts needed */}
            <div className="text-center p-6 rounded-xl bg-card border border-border">
              <ArrowReloadHorizontalIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-2">Prompts Needed</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-red-500">{currentMetrics.without.prompts}</div>
                  <div className="text-xs text-muted-foreground">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentMetrics.with.prompts}</div>
                  <div className="text-xs text-muted-foreground">With CodeBakers</div>
                </div>
              </div>
            </div>

            {/* Errors to fix */}
            <div className="text-center p-6 rounded-xl bg-card border border-border">
              <Alert02Icon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-2">Errors to Fix</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-red-500">{currentMetrics.without.errors}</div>
                  <div className="text-xs text-muted-foreground">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentMetrics.with.errors}</div>
                  <div className="text-xs text-muted-foreground">With CodeBakers</div>
                </div>
              </div>
            </div>

            {/* Time spent */}
            <div className="text-center p-6 rounded-xl bg-card border border-border">
              <Clock01Icon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-2">Time Spent</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-red-500">{currentMetrics.without.time}</div>
                  <div className="text-xs text-muted-foreground">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentMetrics.with.time}</div>
                  <div className="text-xs text-muted-foreground">With CodeBakers</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed comparison cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Without CodeBakers */}
            <div className="rounded-xl border-2 border-red-200 dark:border-red-900/50 overflow-hidden bg-card">
              <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50 flex items-center gap-2">
                <Cancel01Icon className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-700 dark:text-red-400">Without CodeBakers</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-4">What you&apos;ll be fixing:</p>
                <ul className="space-y-2">
                  {currentMetrics.without.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Cancel01Icon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* With CodeBakers */}
            <div className="rounded-xl border-2 border-green-200 dark:border-green-900/50 overflow-hidden bg-card">
              <div className="px-4 py-3 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-900/50 flex items-center gap-2">
                <Tick02Icon className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-700 dark:text-green-400">With CodeBakers</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-4">What&apos;s included automatically:</p>
                <ul className="space-y-2">
                  {currentMetrics.with.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Tick02Icon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bonus row */}
          <div className="grid grid-cols-3 gap-4 mb-8 text-center">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50">
              <SecurityCheckIcon className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <div className="text-sm font-medium text-green-700 dark:text-green-300">Security Built-in</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50">
              <TestTube01Icon className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <div className="text-sm font-medium text-green-700 dark:text-green-300">Tests Included</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50">
              <CodeIcon className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <div className="text-sm font-medium text-green-700 dark:text-green-300">TypeScript Types</div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Get production-ready code from <span className="text-foreground font-semibold">every prompt</span>.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
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
          <AiBrain02Icon className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p>Type a feature above and click Compare to see the difference</p>
        </div>
      )}
    </div>
  );
}
