'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Terminal, ArrowRight, Sparkles, CreditCard, Users, Plug, RefreshCw, AlertCircle, CheckCircle, XCircle, Copy, BarChart3, Clock, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrialInfo {
  stage: 'anonymous' | 'extended' | 'expired' | 'converted' | null;
  daysRemaining: number;
  canExtend: boolean;
  githubUsername?: string | null;
  expiresAt?: Date | null;
}

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
  trial?: TrialInfo | null;
}

export function DashboardContent({ stats, apiKey, trial }: DashboardContentProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const hasActiveSubscription =
    stats.subscription?.status === 'active' || stats.subscription?.isBeta;

  const isTrialUser = !hasActiveSubscription && trial && trial.stage !== 'converted';
  const isTrialExpired = trial?.stage === 'expired' || (trial && trial.daysRemaining <= 0);
  const isTrialExpiringSoon = trial && trial.daysRemaining > 0 && trial.daysRemaining <= 2;

  const regenerateKey = async () => {
    setIsRegenerating(true);
    setMessage(null);
    setShowConfirm(false);
    setNewKey(null);
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
      const generatedKey = result.data.key;

      // Store the key to display it
      setNewKey(generatedKey);

      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(generatedKey);
        setMessage({ type: 'success', text: 'New API key generated and copied to clipboard!' });
      } catch {
        setMessage({ type: 'success', text: 'New API key generated! Copy it from below.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate new API key. Please try again.' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyKey = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setMessage({ type: 'success', text: 'Key copied to clipboard!' });
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
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                hasActiveSubscription ? 'bg-red-600/20' :
                isTrialExpired ? 'bg-red-500/20' :
                isTrialExpiringSoon ? 'bg-amber-500/20' :
                'bg-emerald-500/20'
              }`}>
                {isTrialUser ? (
                  <Clock className={`w-6 h-6 ${
                    isTrialExpired ? 'text-red-400' :
                    isTrialExpiringSoon ? 'text-amber-400' :
                    'text-emerald-400'
                  }`} />
                ) : (
                  <Sparkles className="w-6 h-6 text-red-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-lg">
                    {hasActiveSubscription
                      ? `${stats.subscription?.plan?.charAt(0).toUpperCase()}${stats.subscription?.plan?.slice(1)} Plan`
                      : isTrialExpired
                        ? 'Trial Expired'
                        : trial?.stage === 'extended'
                          ? 'Extended Trial'
                          : '7-Day Free Trial'}
                  </span>
                  {stats.subscription?.isBeta && (
                    <Badge className="bg-purple-600">Beta</Badge>
                  )}
                  {trial?.stage === 'extended' && trial.githubUsername && (
                    <Badge className="bg-slate-700 gap-1">
                      <Github className="w-3 h-3" />
                      @{trial.githubUsername}
                    </Badge>
                  )}
                </div>
                <p className="text-neutral-400 text-sm">
                  {hasActiveSubscription
                    ? 'Unlimited projects & all 40 modules'
                    : isTrialExpired
                      ? 'Upgrade to continue using CodeBakers'
                      : `${trial?.daysRemaining || 0} day${trial?.daysRemaining !== 1 ? 's' : ''} remaining`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Show extend button for anonymous trial users */}
              {isTrialUser && trial?.canExtend && trial.stage === 'anonymous' && !isTrialExpired && (
                <Link href="/api/auth/github?extend=true">
                  <Button variant="outline" className="gap-2 border-neutral-700 hover:bg-neutral-800">
                    <Github className="w-4 h-4" />
                    +7 Days Free
                  </Button>
                </Link>
              )}
              <Link href="/billing">
                <Button className={isTrialUser || isTrialExpired ? "bg-red-600 hover:bg-red-700 gap-2" : "bg-neutral-800 hover:bg-neutral-700 gap-2"}>
                  {isTrialUser || isTrialExpired ? 'Upgrade to Pro' : 'Manage Billing'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Trial countdown for trial users */}
          {isTrialUser && !isTrialExpired && (
            <div className={`mt-6 p-4 rounded-lg border ${
              isTrialExpiringSoon
                ? 'bg-amber-900/20 border-amber-700/50'
                : 'bg-emerald-900/20 border-emerald-700/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className={`w-5 h-5 ${isTrialExpiringSoon ? 'text-amber-400' : 'text-emerald-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isTrialExpiringSoon ? 'text-amber-200' : 'text-emerald-200'}`}>
                      {trial?.daysRemaining} day{trial?.daysRemaining !== 1 ? 's' : ''} left in your trial
                    </p>
                    <p className="text-xs text-neutral-400">
                      {trial?.stage === 'anonymous'
                        ? 'Connect GitHub to extend for 7 more days free'
                        : 'Full access to all 40 modules'}
                    </p>
                  </div>
                </div>
                {trial?.canExtend && trial.stage === 'anonymous' && (
                  <Link href="/api/auth/github?extend=true">
                    <Button size="sm" variant="outline" className="gap-2 border-amber-600 text-amber-300 hover:bg-amber-900/30">
                      <Github className="w-4 h-4" />
                      Extend Trial
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Expired trial message */}
          {isTrialExpired && (
            <div className="mt-6 p-4 rounded-lg bg-red-900/20 border border-red-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-200">
                      {trial?.canExtend
                        ? 'Trial expired - Connect GitHub for 7 more days free!'
                        : 'Your trial has ended'}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Upgrade to Pro ($49/mo) for unlimited access
                    </p>
                  </div>
                </div>
                {trial?.canExtend ? (
                  <Link href="/api/auth/github?extend=true">
                    <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Github className="w-4 h-4" />
                      Extend Free
                    </Button>
                  </Link>
                ) : (
                  <Link href="/billing">
                    <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700">
                      Upgrade Now
                    </Button>
                  </Link>
                )}
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
              {!showConfirm ? (
                <Button
                  onClick={() => setShowConfirm(true)}
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
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={regenerateKey}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Confirm
                  </Button>
                  <Button
                    onClick={() => setShowConfirm(false)}
                    variant="outline"
                    className="border-neutral-700 hover:bg-neutral-800"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            {showConfirm && !message && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-200">
                  Your current key will stop working. Are you sure?
                </p>
              </div>
            )}
            {message && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-sm ${message.type === 'success' ? 'text-green-200' : 'text-red-200'}`}>
                  {message.text}
                </p>
              </div>
            )}
            {newKey && (
              <div className="space-y-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-200 font-medium">Your new API key (save it now!):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono bg-black text-green-300 px-3 py-2 rounded text-sm break-all select-all">
                    {newKey}
                  </code>
                  <Button
                    onClick={copyKey}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 shrink-0 gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-green-300/70">
                  This key will not be shown again after you leave this page.
                </p>
              </div>
            )}
            {!message && !showConfirm && !newKey && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-200">
                  Lost your key? Click "New Key" to generate a fresh one.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/analytics" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  Analytics
                </p>
                <p className="text-sm text-neutral-400">View usage stats</p>
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

        <Link href="/quickstart" className="group">
          <Card className="bg-neutral-900/80 border-neutral-800 hover:border-red-500/50 transition-colors h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <Plug className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-red-400 transition-colors">
                  Quick Start
                </p>
                <p className="text-sm text-neutral-400">Setup guide & commands</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
