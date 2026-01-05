'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ArrowRight,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Rocket,
  Shield,
  Github,
  Plug,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRODUCT } from '@/lib/constants';

interface QuickStartData {
  teamName: string;
  hasActiveSubscription: boolean;
  isBeta: boolean;
  trial?: {
    daysRemaining: number;
    endsAt: string;
  } | null;
}

export default function QuickStartPage() {
  const router = useRouter();
  const [data, setData] = useState<QuickStartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/quickstart');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const isPaidUser = data?.hasActiveSubscription || data?.isBeta;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Rocket className="w-8 h-8 text-red-400" />
          Get Started
        </h1>
        <p className="text-neutral-400 text-lg">
          Install the VS Code extension and start building production-ready apps
        </p>
      </div>

      {/* How It Works */}
      <Card className="bg-neutral-900/80 border-red-600/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {isPaidUser ? (
              <Shield className="w-6 h-6 text-red-400" />
            ) : (
              <Sparkles className="w-6 h-6 text-red-400" />
            )}
            <span className="text-xl font-semibold text-white">How It Works</span>
            {isPaidUser ? (
              <Badge className="bg-red-600">{data?.isBeta ? 'Beta' : 'Pro'}</Badge>
            ) : (
              <Badge className="bg-emerald-600">Free Trial</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold mx-auto">1</div>
              <p className="text-white font-medium">Install Extension</p>
              <p className="text-neutral-400 text-sm">From VS Code Marketplace</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold mx-auto">2</div>
              <p className="text-white font-medium">Sign In with GitHub</p>
              <p className="text-neutral-400 text-sm">One-click authentication</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold mx-auto">✓</div>
              <p className="text-white font-medium">Start Building</p>
              <p className="text-neutral-400 text-sm">Just talk to CodeBakers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Install Extension */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">1</div>
            <div>
              <CardTitle className="text-white">Install VS Code Extension</CardTitle>
              <CardDescription className="text-neutral-400">
                Get CodeBakers from the Visual Studio Marketplace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => window.open(PRODUCT.EXTENSION_URL, '_blank')}
            className="w-full bg-red-600 hover:bg-red-700 gap-2 h-12"
          >
            <Plug className="h-5 w-5" />
            Install CodeBakers Extension
            <ExternalLink className="h-4 w-4" />
          </Button>

          <div className="bg-neutral-800/50 rounded-lg p-4">
            <p className="text-neutral-300 text-sm">
              Or search for <code className="bg-neutral-700 px-2 py-0.5 rounded text-red-400">CodeBakers</code> in the VS Code Extensions panel (<code className="bg-neutral-700 px-2 py-0.5 rounded text-neutral-300">Cmd/Ctrl + Shift + X</code>)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Sign In */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">2</div>
            <div>
              <CardTitle className="text-white">Sign In with GitHub</CardTitle>
              <CardDescription className="text-neutral-400">
                One-click authentication - no passwords needed
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
              <Github className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium mb-1">Click "Sign In" in the Extension</p>
              <p className="text-neutral-400 text-sm">
                After installing, click the CodeBakers icon in the sidebar and press "Sign In with GitHub".
                Your browser will open to authorize the connection.
              </p>
            </div>
          </div>

          <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
            <p className="text-green-300 text-sm">
              <strong>That's it!</strong> Once signed in:
            </p>
            <ul className="mt-2 text-green-200/80 text-sm space-y-1 list-disc list-inside">
              <li>Your GitHub account is connected</li>
              <li>All 40+ production patterns are available</li>
              <li>AI-powered code generation is ready</li>
              {!isPaidUser && <li>14-day free trial starts automatically</li>}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* What You Can Do */}
      {data && (
        <Card className="bg-neutral-900/80 border-green-600/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">✓</div>
              <div>
                <CardTitle className="text-white">Then Just Describe What You Want</CardTitle>
                <CardDescription className="text-neutral-300">The AI handles everything from here</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-purple-600">CodeBakers Chat</Badge>
              <span className="text-neutral-300">Open the chat panel and say things like:</span>
            </div>

            <div className="grid gap-3">
              <div className="bg-black rounded-lg p-4 border border-neutral-800">
                <p className="text-purple-400 font-mono text-sm">
                  "Build me a task management app"
                </p>
                <p className="text-neutral-400 text-xs mt-2">→ AI creates entire project, all files, installs dependencies</p>
              </div>
              <div className="bg-black rounded-lg p-4 border border-neutral-800">
                <p className="text-purple-400 font-mono text-sm">
                  "Add user authentication with email and password"
                </p>
                <p className="text-neutral-400 text-xs mt-2">→ AI uses auth patterns to build login/signup</p>
              </div>
              <div className="bg-black rounded-lg p-4 border border-neutral-800">
                <p className="text-purple-400 font-mono text-sm">
                  "Create a dashboard with stats cards and a data table"
                </p>
                <p className="text-neutral-400 text-xs mt-2">→ AI uses frontend patterns for production-ready UI</p>
              </div>
            </div>

            <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-4 mt-4">
              <p className="text-purple-200 text-sm">
                <strong>No commands needed.</strong> The AI has 40 production patterns loaded. Just describe what you want in plain English - the AI scaffolds projects, creates files, and builds features automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features List */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader
          className="cursor-pointer hover:bg-neutral-800/50 transition-colors rounded-t-lg"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neutral-400" />
              <CardTitle className="text-neutral-400 text-base">What's Included</CardTitle>
            </div>
            <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </div>
          <CardDescription className="text-neutral-400">
            Everything you get with CodeBakers
          </CardDescription>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="pt-0">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-neutral-300">40+ production-ready modules</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-neutral-300">AI-powered code generation</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-neutral-300">Pattern enforcement built-in</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-neutral-300">Authentication, payments, APIs</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-neutral-300">Testing patterns included</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-neutral-300">HIPAA, PCI compliance modules</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Help */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Need help?</p>
              <p className="text-neutral-400 text-sm">Check out our docs or reach out</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-neutral-700" asChild>
                <a href="https://codebakers.ai/docs" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Docs
                </a>
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
