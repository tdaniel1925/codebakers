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
} from 'hugeicons-react';

// Quick suggestion chips for common use cases
const suggestions = [
  'login form',
  'AI chatbot',
  'Stripe checkout',
  'REST API',
  'dashboard',
];

// Comparison stats by feature name (returned by AI)
// These show the "without vs with CodeBakers" comparison
type ComparisonStats = {
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

// Stats lookup by feature name (AI returns the feature name)
const featureStats: Record<string, ComparisonStats> = {
  'Authentication': {
    without: { prompts: '8-12', errors: '5-7', time: '45-60 min', issues: ['Missing loading states', 'No input validation', 'No error messages', 'Not accessible (a11y)', 'No type safety'] },
    with: { prompts: '1', errors: '0', time: '5 min', includes: ['Zod validation built-in', 'Loading & error states', 'ARIA accessible', 'TypeScript types', 'Toast notifications'] },
  },
  'Form': {
    without: { prompts: '6-10', errors: '4-6', time: '30-45 min', issues: ['Missing validation', 'No loading states', 'Poor error UX', 'Not accessible', 'No type safety'] },
    with: { prompts: '1', errors: '0', time: '5 min', includes: ['Zod validation', 'Loading states', 'Inline errors', 'ARIA accessible', 'TypeScript types'] },
  },
  'Payment': {
    without: { prompts: '15-20', errors: '8-12', time: '3-4 hours', issues: ['No webhook handling', 'Missing error recovery', 'Security vulnerabilities', 'No idempotency', 'Database not synced'] },
    with: { prompts: '1', errors: '0', time: '15 min', includes: ['Webhook verification', 'Idempotency keys', 'Database sync', 'Error recovery', 'Security best practices'] },
  },
  'API Endpoint': {
    without: { prompts: '6-10', errors: '4-6', time: '30-45 min', issues: ['No input validation', 'Missing auth checks', 'SQL injection risk', 'No rate limiting', 'Poor error responses'] },
    with: { prompts: '1', errors: '0', time: '5 min', includes: ['Zod validation', 'Auth middleware', 'Parameterized queries', 'Rate limiting', 'Proper status codes'] },
  },
  'File Upload': {
    without: { prompts: '10-15', errors: '6-8', time: '1-2 hours', issues: ['No file validation', 'No size limits', 'Security vulnerabilities', 'No progress indicator', 'No error handling'] },
    with: { prompts: '1', errors: '0', time: '10 min', includes: ['File type validation', 'Size limits enforced', 'Progress tracking', 'S3 presigned URLs', 'Secure by default'] },
  },
  'Dashboard': {
    without: { prompts: '8-12', errors: '5-7', time: '1-2 hours', issues: ['No loading states', 'No error handling', 'Missing skeleton UI', 'No data caching', 'Manual refresh only'] },
    with: { prompts: '1', errors: '0', time: '10 min', includes: ['React Query caching', 'Skeleton loaders', 'Error boundaries', 'Auto-refresh', 'Optimistic updates'] },
  },
  'Search': {
    without: { prompts: '6-10', errors: '4-5', time: '30-45 min', issues: ['No debouncing', 'API flood on every keystroke', 'No loading indicator', 'Missing empty state', 'No keyboard nav'] },
    with: { prompts: '1', errors: '0', time: '5 min', includes: ['Debounced input', 'Loading indicator', 'Keyboard navigation', 'Recent searches', 'ARIA accessible'] },
  },
  'AI Integration': {
    without: { prompts: '10-15', errors: '6-8', time: '2-3 hours', issues: ['No streaming support', 'No error handling', 'Missing rate limits', 'No message history', 'Poor UX on errors'] },
    with: { prompts: '1', errors: '0', time: '15 min', includes: ['Streaming responses', 'Token tracking', 'Rate limiting', 'Error recovery', 'Message persistence'] },
  },
  'Database': {
    without: { prompts: '8-12', errors: '5-7', time: '1-2 hours', issues: ['SQL injection risk', 'No migrations', 'Missing indexes', 'No audit trail', 'Poor error handling'] },
    with: { prompts: '1', errors: '0', time: '10 min', includes: ['Parameterized queries', 'Migration files', 'Proper indexes', 'Audit logging', 'Transaction support'] },
  },
  'Email': {
    without: { prompts: '6-10', errors: '4-5', time: '30-45 min', issues: ['No templates', 'Missing error handling', 'No rate limiting', 'No bounce handling', 'Plain text only'] },
    with: { prompts: '1', errors: '0', time: '5 min', includes: ['React Email templates', 'Error handling', 'Rate limiting', 'Bounce handling', 'HTML + plain text'] },
  },
};

// Default stats for features not in the lookup
const defaultStats: ComparisonStats = {
  without: { prompts: '8-15', errors: '5-10', time: '1-2 hours', issues: ['Missing error handling', 'No loading states', 'No validation', 'Not accessible', 'No tests'] },
  with: { prompts: '1', errors: '0', time: '10 min', includes: ['Error handling', 'Loading states', 'Zod validation', 'Accessibility', 'Playwright tests'] },
};

function getStatsForFeature(featureName: string): ComparisonStats {
  // Try exact match first
  if (featureStats[featureName]) {
    return featureStats[featureName];
  }
  // Try partial match
  for (const [key, stats] of Object.entries(featureStats)) {
    if (featureName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(featureName.toLowerCase())) {
      return stats;
    }
  }
  return defaultStats;
}

export function InteractiveDemo() {
  const [userInput, setUserInput] = useState('');
  const [displayedInput, setDisplayedInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [currentStats, setCurrentStats] = useState<ComparisonStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!userInput.trim()) return;

    setIsGenerating(true);
    setShowResult(false);
    setError(null);

    try {
      // Call the AI-powered optimize-prompt API
      const response = await fetch('/api/optimize-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Demo mode - no auth required for public demo
          'Authorization': 'Bearer demo',
        },
        body: JSON.stringify({ prompt: userInput }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize prompt');
      }

      const data = await response.json();

      setOptimizedPrompt(data.optimizedPrompt);
      setFeatureName(data.featureName || 'Feature');
      setCurrentStats(getStatsForFeature(data.featureName || 'Feature'));
      setDisplayedInput(userInput);
      setShowResult(true);
    } catch (err) {
      console.error('Error optimizing prompt:', err);
      setError('Unable to analyze your request. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
    // Auto-generate after selecting a suggestion
    setTimeout(async () => {
      setIsGenerating(true);
      setShowResult(false);
      setError(null);

      try {
        const response = await fetch('/api/optimize-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer demo',
          },
          body: JSON.stringify({ prompt: suggestion }),
        });

        if (!response.ok) {
          throw new Error('Failed to optimize prompt');
        }

        const data = await response.json();

        setOptimizedPrompt(data.optimizedPrompt);
        setFeatureName(data.featureName || 'Feature');
        setCurrentStats(getStatsForFeature(data.featureName || 'Feature'));
        setDisplayedInput(suggestion);
        setShowResult(true);
      } catch (err) {
        console.error('Error optimizing prompt:', err);
        setError('Unable to analyze your request. Please try again.');
      } finally {
        setIsGenerating(false);
      }
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
      {/* Header - Clear about what this is */}
      <div className="text-center mb-8">
        <Badge className="mb-4 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 px-4 py-1">
          <AiMagicIcon className="h-3 w-3 mr-2" />
          Prompt Optimizer Demo
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          See how we enhance your&nbsp;prompts
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Type a prompt like you would in Cursor or Claude Code.
          <br />
          <span className="text-foreground font-medium">Watch it transform into production-ready instructions.</span>
        </p>
      </div>

      {/* Input area - styled like an IDE */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-card overflow-hidden shadow-lg">
          {/* Fake IDE header */}
          <div className="px-4 py-2 bg-gray-100 dark:bg-muted border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-muted-foreground font-mono ml-2">your prompt</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="add user authentication..."
              className="w-full h-14 px-5 pr-32 bg-white dark:bg-card text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground focus:outline-none text-lg font-mono"
              disabled={isGenerating}
            />
            <Button
              onClick={handleGenerate}
              disabled={!userInput.trim() || isGenerating}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500 hover:bg-amber-600 text-white shadow-md"
            >
              {isGenerating ? (
                <>
                  <Loading03Icon className="mr-2 h-4 w-4 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <AiMagicIcon className="mr-2 h-4 w-4" />
                  Enhance
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="text-sm text-gray-500 dark:text-muted-foreground mr-2">Examples:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isGenerating}
              className="px-3 py-1 text-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted hover:border-amber-300 dark:hover:border-amber-700 text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-all disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-amber-100 dark:border-amber-900 animate-pulse" />
            <Loading03Icon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-amber-500 animate-spin" />
          </div>
          <p className="mt-4 text-muted-foreground animate-pulse">Enhancing your prompt...</p>
        </div>
      )}

      {/* Results - Simple metrics comparison */}
      {showResult && currentStats && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Prompt Transformation - The Main Event */}
          <div className="mb-10 max-w-4xl mx-auto">
            <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-xl">
              {/* Header */}
              <div className="px-5 py-3 bg-muted border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AiMagicIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-foreground">Prompt Transformation</span>
                </div>
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">
                  <Tick02Icon className="h-3 w-3 mr-1" />
                  Enhanced
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Before - Your prompt */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground">1</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">YOUR PROMPT</div>
                      <div className="text-xs text-muted-foreground">What you typed</div>
                    </div>
                  </div>
                  <div className="px-4 py-4 rounded-xl bg-muted font-mono text-foreground">
                    {displayedInput}
                  </div>
                </div>

                {/* After - Enhanced prompt */}
                <div className="p-6 bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                      <AiMagicIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-green-700 dark:text-green-400">ENHANCED PROMPT</div>
                      <div className="text-xs text-green-600 dark:text-green-500">What your AI receives</div>
                    </div>
                  </div>
                  <div className="px-4 py-4 rounded-xl bg-white dark:bg-card border-2 border-green-200 dark:border-green-800 text-foreground text-sm leading-relaxed select-none">
                    {optimizedPrompt}
                  </div>
                </div>
              </div>

              {/* Bottom callout */}
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-border flex items-center justify-center gap-2">
                <AiMagicIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  This enhanced prompt gets sent to your AI in Cursor, Claude Code, etc.
                </span>
              </div>
            </div>
          </div>

          {/* Feature type indicator */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border">
              <span className="text-muted-foreground text-sm">Feature type:</span>
              <span className="text-foreground font-semibold">{featureName}</span>
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
                  <div className="text-2xl font-bold text-red-500">{currentStats.without.prompts}</div>
                  <div className="text-xs text-gray-500">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-gray-300" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentStats.with.prompts}</div>
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
                  <div className="text-2xl font-bold text-red-500">{currentStats.without.errors}</div>
                  <div className="text-xs text-gray-500">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-gray-300" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentStats.with.errors}</div>
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
                  <div className="text-2xl font-bold text-red-500">{currentStats.without.time}</div>
                  <div className="text-xs text-gray-500">Without</div>
                </div>
                <ArrowRight02Icon className="h-5 w-5 text-gray-300" />
                <div>
                  <div className="text-2xl font-bold text-green-500">{currentStats.with.time}</div>
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
                  {currentStats.without.issues.map((issue, i) => (
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
                  {currentStats.with.includes.map((item, i) => (
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
            <p className="text-muted-foreground mb-4">
              Get enhanced prompts for <span className="text-foreground font-semibold">every feature you build</span>.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
                asChild
              >
                <Link href="/signup">
                  Upgrade My Prompts
                  <ArrowRight02Icon className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-border text-foreground hover:bg-muted"
                asChild
              >
                <Link href="#how-it-works">
                  Learn How It Works
                  <ArrowRight02Icon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Initial state - before any generation */}
      {!showResult && !isGenerating && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="max-w-md mx-auto">
            <AiMagicIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="mb-2">Type a prompt above and click <strong>Enhance</strong></p>
            <p className="text-sm opacity-70">See how CodeBakers transforms simple prompts into production-ready instructions</p>
          </div>
        </div>
      )}
    </div>
  );
}
