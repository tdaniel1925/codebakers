'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, Key, Clock, CreditCard, Zap } from 'lucide-react';
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
  };
  apiKey: {
    keyPrefix: string;
    name: string | null;
  } | null;
}

export function DashboardContent({ stats, apiKey }: DashboardContentProps) {
  const [copied, setCopied] = useState(false);

  const copyApiKey = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey.keyPrefix + '_••••••••');
      setCopied(true);
      toast.success('API key prefix copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasActiveSubscription =
    stats.subscription?.status === 'active' || stats.subscription?.isBeta;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome to CodeBakers. Get started with production-ready patterns.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Subscription
            </CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {hasActiveSubscription ? (
                <>
                  <Badge className="bg-green-600">
                    {stats.subscription?.plan?.toUpperCase() || 'ACTIVE'}
                  </Badge>
                  {stats.subscription?.isBeta && (
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      Beta
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  Inactive
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              API Keys
            </CardTitle>
            <Key className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.apiKeyCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Last API Call
            </CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-white">
              {stats.lastApiCall
                ? new Date(stats.lastApiCall).toLocaleDateString()
                : 'Never'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Patterns
            </CardTitle>
            <Zap className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">114</div>
            <p className="text-xs text-slate-400">Production patterns</p>
          </CardContent>
        </Card>
      </div>

      {/* API Key Display */}
      {apiKey && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your API Key</CardTitle>
            <CardDescription>
              Use this key to authenticate CLI requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <code className="flex-1 rounded bg-slate-900 px-4 py-2 font-mono text-sm text-slate-300">
                {apiKey.keyPrefix}_••••••••••••••••
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyApiKey}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Need a new key? Go to{' '}
              <Link href="/setup" className="text-blue-400 hover:underline">
                Setup
              </Link>{' '}
              to manage your API keys.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Start */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Quick Start</CardTitle>
          <CardDescription>Get up and running in minutes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">
              1. Install the CLI
            </p>
            <code className="block rounded bg-slate-900 px-4 py-2 font-mono text-sm text-slate-300">
              npm install -g @codebakers/cli
            </code>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">2. Login</p>
            <code className="block rounded bg-slate-900 px-4 py-2 font-mono text-sm text-slate-300">
              codebakers login
            </code>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">
              3. Install patterns in your project
            </p>
            <code className="block rounded bg-slate-900 px-4 py-2 font-mono text-sm text-slate-300">
              codebakers install
            </code>
          </div>

          <div className="pt-4">
            <Link href="/setup">
              <Button className="bg-blue-600 hover:bg-blue-700">
                View Full Setup Guide
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
