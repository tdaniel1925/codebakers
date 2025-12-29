'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Terminal,
  Rocket,
  Shield,
  Apple,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface QuickStartData {
  apiKey: string | null;
  teamName: string;
  hasActiveSubscription: boolean;
  isBeta: boolean;
  trial?: {
    available: boolean;
    daysAvailable: number;
    extendedDays: number;
  } | null;
}

type IDE = 'claude-code' | 'cursor';

export default function QuickStartPage() {
  const router = useRouter();
  const [data, setData] = useState<QuickStartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedIDE, setSelectedIDE] = useState<IDE>('claude-code');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
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

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const regenerateKey = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default' }),
      });

      if (!response.ok) throw new Error('Failed to generate key');

      const result = await response.json();
      const generatedKey = result.data.key;
      setNewKey(generatedKey);

      try {
        await navigator.clipboard.writeText(generatedKey);
        toast.success('New API key generated and copied!');
      } catch {
        toast.success('New API key generated!');
      }
    } catch (error) {
      toast.error('Failed to generate new API key');
    } finally {
      setIsRegenerating(false);
    }
  };

  const displayKey = newKey || data?.apiKey;
  const isPaidUser = data?.hasActiveSubscription || data?.isBeta;
  const isTrialUser = !isPaidUser;

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
          {isPaidUser ? 'Connect CodeBakers to your AI coding tools' : 'Start your free trial in one command'}
        </p>
      </div>

      {/* TRIAL USER FLOW */}
      {isTrialUser && (
        <>
          {/* The Simple Flow for Trial Users */}
          <Card className="bg-neutral-900/80 border-red-600/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-red-400" />
                <span className="text-xl font-semibold text-white">How It Works</span>
                <Badge className="bg-emerald-600">No API Key Needed</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold mx-auto">1</div>
                  <p className="text-white font-medium">Run One Command</p>
                  <p className="text-neutral-400 text-sm">In your project folder</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold mx-auto">2</div>
                  <p className="text-white font-medium">Patterns Install</p>
                  <p className="text-neutral-400 text-sm">Automatically configured</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold mx-auto">✓</div>
                  <p className="text-white font-medium">Start Building</p>
                  <p className="text-neutral-400 text-sm">Just talk to your AI</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* One-Liner Install for Trial Users */}
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">1</div>
                <div>
                  <CardTitle className="text-white">One-Line Install</CardTitle>
                  <CardDescription className="text-neutral-400">Copy and paste into your terminal:</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mac/Linux */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Apple className="h-4 w-4 text-neutral-400" />
                  <span className="text-sm text-neutral-400 font-medium">Mac / Linux</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-green-400 border border-neutral-800 overflow-x-auto">
                    curl -fsSL codebakers.ai/install.sh | bash
                  </code>
                  <Button
                    onClick={() => copyToClipboard('curl -fsSL codebakers.ai/install.sh | bash', 'install-mac')}
                    className="bg-red-600 hover:bg-red-700 shrink-0"
                  >
                    {copied === 'install-mac' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Windows */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-neutral-400" />
                  <span className="text-sm text-neutral-400 font-medium">Windows (PowerShell)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-blue-400 border border-neutral-800 overflow-x-auto">
                    irm codebakers.ai/install.ps1 | iex
                  </code>
                  <Button
                    onClick={() => copyToClipboard('irm codebakers.ai/install.ps1 | iex', 'install-win')}
                    className="bg-red-600 hover:bg-red-700 shrink-0"
                  >
                    {copied === 'install-win' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  <strong>That's it!</strong> The installer automatically:
                </p>
                <ul className="mt-2 text-green-200/80 text-sm space-y-1 list-disc list-inside">
                  <li>Installs the CodeBakers CLI globally</li>
                  <li>Connects to Claude Code</li>
                  <li>Creates your free 7-day trial</li>
                  <li>Installs 40+ production patterns</li>
                </ul>
              </div>

              {/* Alternative npx command */}
              <div className="pt-4 border-t border-neutral-800">
                <p className="text-xs text-neutral-400 mb-2">Alternative (if you prefer npx):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-black px-3 py-2 font-mono text-xs text-neutral-400 border border-neutral-800">
                    npx @codebakers/cli go
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard('npx @codebakers/cli go', 'go')}
                    className="border-neutral-700 shrink-0"
                  >
                    {copied === 'go' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PAID USER FLOW */}
      {isPaidUser && (
        <>
          {/* The Flow for Paid Users */}
          <Card className="bg-neutral-900/80 border-red-600/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-red-400" />
                <span className="text-xl font-semibold text-white">How It Works</span>
                <Badge className="bg-red-600">Pro</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold mx-auto">1</div>
                  <p className="text-white font-medium">Copy API Key</p>
                  <p className="text-neutral-400 text-sm">Below on this page</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold mx-auto">2</div>
                  <p className="text-white font-medium">Run Setup <span className="text-neutral-400 font-normal">(once)</span></p>
                  <p className="text-neutral-400 text-sm">One terminal command</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold mx-auto">✓</div>
                  <p className="text-white font-medium">Just Talk to AI</p>
                  <p className="text-neutral-400 text-sm">"Build me a todo app"</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: API Key (Paid Users Only) */}
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">1</div>
                <div>
                  <CardTitle className="text-white">Your API Key</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Copy this - you'll paste it in the next step
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-green-400 border border-neutral-800 overflow-x-auto select-all">
                  {displayKey || 'Loading...'}
                </code>
                <Button
                  onClick={() => displayKey && copyToClipboard(displayKey, 'apiKey')}
                  className="bg-red-600 hover:bg-red-700 shrink-0"
                >
                  {copied === 'apiKey' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Key
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerateKey}
                  disabled={isRegenerating}
                  className="border-neutral-700 text-neutral-400 hover:text-white"
                >
                  {isRegenerating ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Generate New Key
                    </>
                  )}
                </Button>
                <span className="text-xs text-neutral-400">(Old key stops working)</span>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Run Setup (Paid Users) */}
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">2</div>
                <div>
                  <CardTitle className="text-white">Run Setup</CardTitle>
                  <CardDescription className="text-neutral-400">One command in your terminal - paste your API key when prompted</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IDE Selection */}
              <Tabs value={selectedIDE} onValueChange={(v) => setSelectedIDE(v as IDE)}>
                <TabsList className="bg-neutral-800 border border-neutral-700">
                  <TabsTrigger value="claude-code" className="data-[state=active]:bg-red-600">
                    Claude Code
                  </TabsTrigger>
                  <TabsTrigger value="cursor" className="data-[state=active]:bg-red-600">
                    Cursor
                  </TabsTrigger>
                </TabsList>

                {/* Claude Code Instructions */}
                <TabsContent value="claude-code" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">TERMINAL</Badge>
                      <span className="text-sm text-neutral-400">Open any terminal and run:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-red-400 border border-neutral-800">
                        npx @codebakers/cli setup
                      </code>
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard('npx @codebakers/cli setup', 'setup')}
                        className="border-neutral-700 shrink-0"
                      >
                        {copied === 'setup' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-neutral-400">
                      Paste your API key when prompted. Setup handles everything else.
                    </p>
                  </div>

                  <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                    <p className="text-green-300 text-sm">
                      <strong>Done!</strong> Restart Claude Code, then just describe what you want to build.
                    </p>
                  </div>
                </TabsContent>

                {/* Cursor Instructions */}
                <TabsContent value="cursor" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">TERMINAL</Badge>
                      <span className="text-sm text-neutral-400">Open any terminal and run:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-red-400 border border-neutral-800">
                        npx @codebakers/cli setup
                      </code>
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard('npx @codebakers/cli setup', 'setup-cursor')}
                        className="border-neutral-700 shrink-0"
                      >
                        {copied === 'setup-cursor' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-neutral-400">Then add MCP server to Cursor:</p>
                    <p className="text-neutral-300 text-sm">
                      Press <code className="bg-neutral-800 px-2 py-0.5 rounded text-xs">Cmd/Ctrl + Shift + J</code> → <strong>MCP</strong> tab → Add:
                    </p>
                    <div className="rounded-lg bg-black border border-neutral-800 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-neutral-400">mcp.json</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(`{
  "mcpServers": {
    "codebakers": {
      "command": "npx",
      "args": ["-y", "@codebakers/cli", "serve"]
    }
  }
}`, 'mcp-config')}
                          className="h-6 px-2 text-neutral-500 hover:text-white"
                        >
                          {copied === 'mcp-config' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre className="font-mono text-sm text-red-400 whitespace-pre overflow-x-auto">{`{
  "mcpServers": {
    "codebakers": {
      "command": "npx",
      "args": ["-y", "@codebakers/cli", "serve"]
    }
  }
}`}</pre>
                    </div>
                  </div>

                  <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
                    <p className="text-green-300 text-sm">
                      <strong>Done!</strong> Restart Cursor, then just describe what you want to build.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* What You Can Do (shown for all users) */}
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
              <Badge className="bg-purple-600">AI CHAT</Badge>
              <span className="text-neutral-300">Open your AI and say things like:</span>
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

      {/* Advanced: CLI Commands (Collapsed by default) */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader
          className="cursor-pointer hover:bg-neutral-800/50 transition-colors rounded-t-lg"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-neutral-400" />
              <CardTitle className="text-neutral-400 text-base">Optional: CLI Commands</CardTitle>
            </div>
            <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </div>
          <CardDescription className="text-neutral-400">
            For power users who prefer terminal commands
          </CardDescription>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="pt-0">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers go</code>
                <span className="text-neutral-400">Start trial & install patterns (no API key)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers setup</code>
                <span className="text-neutral-400">Configure with API key (paid users)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers scaffold</code>
                <span className="text-neutral-400">Create new project with full stack</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers init</code>
                <span className="text-neutral-400">Add patterns to existing project</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers generate</code>
                <span className="text-neutral-400">Generate components, APIs, services</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers doctor</code>
                <span className="text-neutral-400">Diagnose setup issues</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-red-400 font-mono w-48">codebakers upgrade</code>
                <span className="text-neutral-400">Update to latest patterns</span>
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
