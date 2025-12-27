'use client';

import { User } from '@supabase/supabase-js';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Key,
  User as UserIcon,
  Mail,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { Team } from '@/db';

interface Stats {
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
}

interface AccountContentProps {
  user: User;
  stats: Stats;
  team: Team | null;
  apiKey: string | null;
}

export function AccountContent({ user, stats, team, apiKey }: AccountContentProps) {
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);

  const regenerateApiKey = async () => {
    if (!confirm('Are you sure? This will invalidate your current API key.')) {
      return;
    }

    setIsRegeneratingKey(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default' }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate key');
      }

      toast.success('New API key generated. Refresh the page to see it.');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to regenerate API key');
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const getPlanBadge = () => {
    if (stats.subscription?.isBeta) {
      return <Badge className="bg-purple-600">Beta Access</Badge>;
    }
    if (stats.subscription?.status === 'active') {
      return <Badge className="bg-green-600">{stats.subscription?.plan?.toUpperCase() || 'ACTIVE'}</Badge>;
    }
    return <Badge variant="secondary">No Active Plan</Badge>;
  };

  const getStatusIcon = () => {
    if (stats.subscription?.status === 'active' || stats.subscription?.isBeta) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <AlertCircle className="h-5 w-5 text-amber-500" />;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Account</h1>
        <p className="text-slate-400 mt-1">
          Manage your account settings and view your subscription details
        </p>
      </div>

      {/* Profile Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-neutral-400">Name</Label>
              <div className="flex items-center gap-2 text-white">
                <UserIcon className="h-4 w-4 text-neutral-500" />
                {user.user_metadata?.full_name || 'Not set'}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-400">Email</Label>
              <div className="flex items-center gap-2 text-white">
                <Mail className="h-4 w-4 text-neutral-500" />
                {user.email}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-400">Account Created</Label>
              <div className="flex items-center gap-2 text-white">
                <Calendar className="h-4 w-4 text-neutral-500" />
                {formatDate(user.created_at)}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-400">Last Sign In</Label>
              <div className="flex items-center gap-2 text-white">
                <Calendar className="h-4 w-4 text-neutral-500" />
                {formatDate(user.last_sign_in_at || null)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>Your current plan and usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <p className="text-white font-medium">Current Plan</p>
                <p className="text-sm text-neutral-400">
                  {stats.subscription?.status === 'active'
                    ? `Paid via ${team?.paymentProvider || 'PayPal'}`
                    : stats.subscription?.isBeta
                      ? 'Admin-granted beta access'
                      : 'No active subscription - upgrade to access all 40 modules'}
                </p>
              </div>
            </div>
            {getPlanBadge()}
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-neutral-800">
            <div className="space-y-2">
              <Label className="text-neutral-400">API Keys</Label>
              <p className="text-2xl font-bold text-white">{stats.apiKeyCount}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-400">Last API Call</Label>
              <p className="text-white">{stats.lastApiCall ? formatDate(stats.lastApiCall) : 'Never'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key
          </CardTitle>
          <CardDescription>Use this key to authenticate with CodeBakers CLI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <>
              <div className="space-y-2">
                <Label className="text-neutral-400">Active Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono bg-neutral-800 border border-neutral-700 text-neutral-300 px-3 py-2 rounded-md">
                    {apiKey}_****...****
                  </code>
                </div>
                <p className="text-xs text-neutral-500">
                  For security, the full key is only shown once when generated. Go to IDE Setup to generate a new key if needed.
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
                <p className="text-sm text-neutral-400">
                  Need a new key? This will invalidate your current key.
                </p>
                <Button
                  variant="outline"
                  onClick={regenerateApiKey}
                  disabled={isRegeneratingKey}
                  className="border-neutral-700 hover:bg-neutral-800"
                >
                  {isRegeneratingKey ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate Key
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-neutral-400 mb-4">No API key found. Go to IDE Setup to generate one.</p>
              <Button
                onClick={() => window.location.href = '/onboarding'}
                className="bg-red-600 hover:bg-red-700"
              >
                <Key className="h-4 w-4 mr-2" />
                Go to IDE Setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
