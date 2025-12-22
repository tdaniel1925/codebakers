'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, ArrowRight, Terminal, Sparkles, PartyPopper, Code2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface OnboardingData {
  apiKey: string | null;
  teamName: string;
}

type IDE = 'cursor' | 'claude-code' | null;

const ideOptions = [
  {
    id: 'cursor' as IDE,
    name: 'Cursor',
    logo: '/logos/cursor.svg',
    description: 'AI-powered code editor',
  },
  {
    id: 'claude-code' as IDE,
    name: 'Claude Code',
    logo: '/logos/claude.svg',
    description: 'Anthropic\'s CLI coding assistant',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedIDE, setSelectedIDE] = useState<IDE>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const fetchOnboardingData = async () => {
    try {
      const response = await fetch('/api/onboarding');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      toast.error('Failed to load onboarding data');
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

  const completeOnboarding = async () => {
    setIsCompleting(true);
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' });
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to complete onboarding');
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Progress value={progress} className="h-1 rounded-none bg-neutral-900" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Step 1: Choose IDE */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-red-600/20 flex items-center justify-center mx-auto mb-6">
                  <Code2 className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Welcome to CodeBakers!
                </h1>
                <p className="text-neutral-400 text-lg">
                  Which AI coding tool are you using?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {ideOptions.map((ide) => (
                  <button
                    key={ide.id}
                    onClick={() => setSelectedIDE(ide.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedIDE === ide.id
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src={ide.logo}
                        alt={ide.name}
                        className="w-8 h-8"
                      />
                      <span className="font-medium text-white">{ide.name}</span>
                    </div>
                    <p className="text-sm text-neutral-500">{ide.description}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedIDE}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 gap-2 disabled:opacity-50"
                >
                  Next: Get API Key
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: API Key */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-red-600/20 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Your API Key
                </h1>
                <p className="text-neutral-400 text-lg">
                  Copy this key — you'll need it in the next step
                </p>
              </div>

              <Card className="bg-neutral-900/80 border-neutral-800">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-neutral-300 border border-neutral-800 overflow-x-auto">
                      {data?.apiKey || 'Loading...'}
                    </code>
                    <Button
                      onClick={() => data?.apiKey && copyToClipboard(data.apiKey, 'apiKey')}
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
                          Copy
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3 mt-4">
                    <p className="text-sm text-amber-400">
                      💡 Save this key somewhere safe. You can always find it in Settings.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="text-neutral-400 hover:text-white"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 gap-2"
                >
                  Next: Setup {ideOptions.find(i => i.id === selectedIDE)?.name}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: IDE-specific setup */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-red-600/20 flex items-center justify-center mx-auto mb-6">
                  <Terminal className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Setup {ideOptions.find(i => i.id === selectedIDE)?.name}
                </h1>
                <p className="text-neutral-400 text-lg">
                  {selectedIDE === 'claude-code' && 'Run these commands in your terminal'}
                  {selectedIDE === 'cursor' && 'Follow these steps to connect CodeBakers'}
                </p>
              </div>

              <Card className="bg-neutral-900/80 border-neutral-800">
                <CardContent className="p-6 space-y-6">
                  {/* Claude Code Setup */}
                  {selectedIDE === 'claude-code' && (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">1</div>
                          <span className="font-medium text-white">Run setup (enter your API key when prompted)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-red-400 border border-neutral-800">
                            npx @codebakers/cli setup
                          </code>
                          <Button variant="outline" onClick={() => copyToClipboard('npx @codebakers/cli setup', 'setup')} className="border-neutral-700 shrink-0">
                            {copied === 'setup' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">2</div>
                          <span className="font-medium text-white">Add CodeBakers to Claude Code</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-red-400 border border-neutral-800 break-all">
                            /mcp add codebakers npx -y @codebakers/cli serve
                          </code>
                          <Button variant="outline" onClick={() => copyToClipboard('/mcp add codebakers npx -y @codebakers/cli serve', 'mcp')} className="border-neutral-700 shrink-0">
                            {copied === 'mcp' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">Run inside Claude Code (CMD/Ctrl + K → type the command)</p>
                      </div>
                    </>
                  )}

                  {/* Cursor Setup - MCP */}
                  {selectedIDE === 'cursor' && (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">1</div>
                          <span className="font-medium text-white">Run setup (enter your API key when prompted)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded-lg bg-black px-4 py-3 font-mono text-sm text-red-400 border border-neutral-800">
                            npx @codebakers/cli setup
                          </code>
                          <Button variant="outline" onClick={() => copyToClipboard('npx @codebakers/cli setup', 'setup')} className="border-neutral-700 shrink-0">
                            {copied === 'setup' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">2</div>
                          <span className="font-medium text-white">Open Cursor Settings</span>
                        </div>
                        <p className="text-neutral-400 text-sm">Press <code className="bg-neutral-800 px-2 py-0.5 rounded text-xs">Cmd/Ctrl + Shift + J</code> or go to <strong className="text-white">Cursor Settings → MCP</strong></p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">3</div>
                          <span className="font-medium text-white">Add new MCP server</span>
                        </div>
                        <p className="text-neutral-400 text-sm mb-3">Click <strong className="text-white">"+ Add new MCP server"</strong> and paste this config:</p>
                        <div className="rounded-lg bg-black border border-neutral-800 p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-neutral-500">mcp.json</span>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`{
  "mcpServers": {
    "codebakers": {
      "command": "npx",
      "args": ["-y", "@codebakers/cli", "serve"]
    }
  }
}`, 'mcp-config')} className="h-6 px-2 text-neutral-500 hover:text-white">
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
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">4</div>
                          <span className="font-medium text-white">Restart Cursor</span>
                        </div>
                        <p className="text-neutral-400 text-sm">Close and reopen Cursor. You should see "codebakers" in your MCP servers list.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} className="text-neutral-400 hover:text-white">Back</Button>
                <Button onClick={() => setStep(4)} size="lg" className="bg-red-600 hover:bg-red-700 gap-2">
                  I've done this
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: All Done */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-green-600/20 flex items-center justify-center mx-auto mb-6">
                  <PartyPopper className="w-10 h-10 text-green-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  You're all set!
                </h1>
                <p className="text-neutral-400 text-lg">
                  CodeBakers is now enhancing your prompts
                </p>
              </div>

              <Card className="bg-neutral-900/80 border-neutral-800">
                <CardContent className="p-6 space-y-4">
                  <p className="text-white font-medium text-center">Try your first enhanced prompt:</p>

                  <div className="bg-black rounded-lg p-4 border border-neutral-800">
                    <p className="text-neutral-400 text-sm mb-2">Ask Claude Code:</p>
                    <p className="text-red-400 font-mono italic">
                      "Build a login form with validation"
                    </p>
                  </div>

                  <p className="text-center text-neutral-400 text-sm">
                    Claude now has access to <span className="text-white font-semibold">34 production patterns</span> that transform your simple prompts into production-ready code.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-green-900/20 border-green-600/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    <p className="text-green-300 text-sm">
                      <strong>Free tier:</strong> 10 pattern downloads included. Upgrade anytime for unlimited access.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Button
                  onClick={completeOnboarding}
                  disabled={isCompleting}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 gap-2 px-8"
                >
                  {isCompleting ? 'Redirecting...' : 'Go to Dashboard'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s === step ? 'bg-red-500' : s < step ? 'bg-red-500/50' : 'bg-neutral-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
