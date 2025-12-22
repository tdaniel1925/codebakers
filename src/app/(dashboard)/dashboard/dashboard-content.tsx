'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Terminal, FolderCode, ArrowRight, Sparkles, CreditCard, Users, Plug, RefreshCw, AlertCircle } from 'lucide-react';
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
  } | null;
}

export function DashboardContent({ stats, apiKey }: DashboardContentProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const hasActiveSubscription =
    stats.subscription?.status === 'active' || stats.subscription?.isBeta;

  const isFreeUser = !hasActiveSubscription;
  const hasLockedProject = !!stats.freeTrialProject;

  const regenerateKey = async () => {
    if (!confirm('Generate a new API key? Your current key will stop working.')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default' }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate key');
      }

      const result = await response.json();

      // Copy the new key to clipboard (key is in result.data.key due to successResponse wrapper)
      await navigator.clipboard.writeText(result.data.key);
      toast.success('New API key generated and copied to clipboard! Save it now - it won\'t be shown again.');

      // Refresh the page to show updated key prefix
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      toast.error('Failed to generate new API key');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Dashboard
        </h1>
        <p className="text-neutral-400">
          Manage your CodeBakers account and subscription
        </p>
      </div>

      {/* Subscription Status Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-400" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
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

            <Link href="/billing">
              <Button className={isFreeUser ? "bg-red-600 hover:bg-red-700 gap-2" : "bg-neutral-800 hover:bg-neutral-700 gap-2"}>
                {isFreeUser ? 'Upgrade Plan' : 'Manage Billing'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
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
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <code className="block w-full rounded-lg bg-black px-4 py-3 font-mono text-sm text-neutral-300 border border-neutral-800">
                  {apiKey.keyPrefix}_••••••••••••••••
                </code>
              </div>
              <Button
                onClick={regenerateKey}
                disabled={isRegenerating}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                {isRegenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    New Key
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-200">
                Lost your key? Click "New Key" to generate a fresh one. The new key will be copied to your clipboard automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/onboarding" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <Plug className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  IDE Setup
                </p>
                <p className="text-sm text-neutral-400">Configure your IDE</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/team" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  Team
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
                  Billing
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
