'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, CreditCard, Users, Plug, AlertCircle, BarChart3, Clock, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING, TRIAL, MODULES } from '@/lib/constants';

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
    seatLimit?: number | null;
  };
  trial?: TrialInfo | null;
}

export function DashboardContent({ stats, trial }: DashboardContentProps) {
  const hasActiveSubscription =
    stats.subscription?.status === 'active' || stats.subscription?.isBeta;

  const isTrialUser = !hasActiveSubscription && trial && trial.stage !== 'converted';
  const isTrialExpired = trial?.stage === 'expired' || (trial && trial.daysRemaining <= 0);
  const isTrialExpiringSoon = trial && trial.daysRemaining > 0 && trial.daysRemaining <= TRIAL.EXPIRING_SOON_THRESHOLD;

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
                          : `${TRIAL.ANONYMOUS_DAYS}-Day Free Trial`}
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
                    ? `Unlimited projects & all ${MODULES.COUNT} modules`
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
                    +{TRIAL.EXTENDED_DAYS} Days Free
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
                        ? `Connect GitHub to extend for ${TRIAL.EXTENDED_DAYS} more days free`
                        : `Full access to all ${MODULES.COUNT} modules`}
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
                        ? `Trial expired - Connect GitHub for ${TRIAL.EXTENDED_DAYS} more days free!`
                        : 'Your trial has ended'}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Upgrade to Pro (${PRICING.PRO.MONTHLY}/mo) for unlimited access
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

      {/* VS Code Extension Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Plug className="w-5 h-5 text-red-400" />
            VS Code Extension
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Use CodeBakers directly in VS Code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-neutral-300 text-sm">
            Install the CodeBakers extension from the VS Code Marketplace to get production-ready code with enforced patterns.
          </p>
          <Button
            onClick={() => window.open('https://marketplace.visualstudio.com/items?itemName=codebakers.codebakers', '_blank')}
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            <Plug className="w-4 h-4" />
            Install Extension
          </Button>
        </CardContent>
      </Card>

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
