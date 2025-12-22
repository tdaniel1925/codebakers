'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, Terminal, FolderCode, ArrowRight, Sparkles, CheckCircle2, Zap, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DashboardContentProps {
  stats: {
    hasTeam: boolean;
    teamId?: string;
    teamName?: string;
    subscription?: {
      plan: string | null;
      status: string | null;
      isBeta: boolean;
    } | null;
    apiKeyCount: number;
    lastApiCall: Date | null;
    seatLimit?: number | null;
    freeTrialProject?: {
      id: string;
      name: string | null;
    } | null;
  };
  apiKey: {
    keyPrefix: string;
    name: string | null;
    fullKey?: string;
  } | null;
}

export function DashboardContent({ stats, apiKey }: DashboardContentProps) {
  const [copied, setCopied] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [showKey, setShowKey] = useState(false);

  const hasActiveSubscription =
    stats.subscription?.status === 'active' || stats.subscription?.isBeta;

  const isFreeUser = !hasActiveSubscription;
  const hasLockedProject = !!stats.freeTrialProject;

  const copyApiKey = async () => {
    if (apiKey?.fullKey) {
      await navigator.clipboard.writeText(apiKey.fullKey);
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else if (apiKey) {
      await navigator.clipboard.writeText(apiKey.keyPrefix);
      setCopied(true);
      toast.success('API key prefix copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyCommand = async (command: string, stepId: number) => {
    await navigator.clipboard.writeText(command);
    setCopiedStep(stepId);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedStep(null), 2000);
  };

  // Steps for getting started - MCP approach (no local files)
  const steps = [
    {
      id: 1,
      title: 'Run setup command',
      description: 'Open your terminal and run:',
      command: 'npx @codebakers/cli setup',
      note: 'This will prompt for your API key (shown below)',
      completed: !!stats.lastApiCall,
    },
    {
      id: 2,
      title: 'Enable in Claude Code',
      description: 'Copy this into Claude Code:',
      command: '/mcp add codebakers npx -y @codebakers/cli serve',
      note: 'One-time setup, no restart needed!',
      completed: false,
    },
    {
      id: 3,
      title: 'Start building!',
      description: 'Ask Claude to build something:',
      command: '"Build a login form with validation"',
      note: 'Claude now has access to 34 production patterns',
      isPrompt: true,
      completed: false,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome to CodeBakers
        </h1>
        <p className="text-neutral-400">
          Production-ready patterns for AI-assisted development
        </p>
      </div>

      {/* Status Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasActiveSubscription ? 'bg-red-600/20' : 'bg-red-500/10'}`}>
                <Sparkles className={`w-6 h-6 ${hasActiveSubscription ? 'text-red-400' : 'text-red-500'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-lg">
                    {hasActiveSubscription
                      ? `${stats.subscription?.plan?.charAt(0).toUpperCase()}${stats.subscription?.plan?.slice(1)} Plan`
                      : 'Free Trial'}
                  </span>
                  {stats.subscription?.isBeta && (
                    <Badge className="bg-red-600">Beta</Badge>
                  )}
                </div>
                <p className="text-neutral-400 text-sm">
                  {hasActiveSubscription
                    ? 'Unlimited projects'
                    : hasLockedProject
                      ? 'Unlimited usage for 1 project'
                      : 'Unlimited usage for your first project'}
                </p>
              </div>
            </div>

            {isFreeUser && (
              <Link href="/billing">
                <Button className="bg-red-600 hover:bg-red-700 gap-2">
                  Upgrade for More Projects
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>

          {/* Project info for free users */}
          {isFreeUser && hasLockedProject && (
            <div className="mt-6 p-4 rounded-lg bg-black/50 border border-neutral-800">
              <div className="flex items-center gap-3">
                <FolderCode className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-sm text-neutral-400">Free trial locked to:</p>
                  <p className="text-white font-medium">{stats.freeTrialProject?.name || 'Your Project'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Key Card */}
      {apiKey && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-red-400" />
              Your API Key
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Use this key to authenticate with the CLI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <code className="block w-full rounded-lg bg-black px-4 py-3 font-mono text-sm text-neutral-300 border border-neutral-800">
                  {showKey && apiKey.fullKey
                    ? apiKey.fullKey
                    : `${apiKey.keyPrefix}_${'•'.repeat(24)}`}
                </code>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowKey(!showKey)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                {showKey ? 'Hide' : 'Show'}
              </Button>
              <Button
                onClick={copyApiKey}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Getting Started Steps */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-400" />
            Get Started in 3 Steps
          </CardTitle>
          <CardDescription className="text-neutral-400">
            One-time setup. No files stored locally. Works across all projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                step.completed
                  ? 'bg-red-600/10 border border-red-500/20'
                  : 'bg-black/50 border border-neutral-800'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-red-500" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-neutral-700 flex items-center justify-center">
                    <span className="text-xs text-neutral-400">{step.id}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${step.completed ? 'text-red-400' : 'text-white'}`}>
                  {step.title}
                </p>
                <p className="text-sm text-neutral-400 mt-1">{step.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className={`flex-1 rounded bg-black px-3 py-2 font-mono text-sm overflow-x-auto border border-neutral-800 ${step.isPrompt ? 'text-red-400 italic' : 'text-neutral-300'}`}>
                    {step.command}
                  </code>
                  {!step.isPrompt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCommand(step.command, step.id)}
                      className="text-neutral-400 hover:text-white hover:bg-neutral-800 shrink-0"
                    >
                      {copiedStep === step.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                {step.note && (
                  <p className="text-xs text-neutral-500 mt-2">{step.note}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/setup" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <Terminal className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  Full Setup Guide
                </p>
                <p className="text-sm text-neutral-400">Detailed instructions</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/team" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  Team Settings
                </p>
                <p className="text-sm text-neutral-400">Manage your team</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  Billing & Plans
                </p>
                <p className="text-sm text-neutral-400">Manage subscription</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
