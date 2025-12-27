'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  AlertTriangle,
  FileWarning,
  TrendingUp,
  Shield,
  Loader2,
  ArrowRight,
  Ban,
  Star,
  Clock,
  Github,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TrialStats {
  totalTrials: number;
  activeAnonymous: number;
  activeExtended: number;
  expiredTrials: number;
  convertedTrials: number;
  flaggedDevices: number;
  expiringToday: number;
  expiringThisWeek: number;
  conversionRate: number;
  extensionRate: number;
}

interface Stats {
  users: {
    totalUsers: number;
    activeSubscriptions: number;
    betaUsers: number;
    suspendedUsers: number;
    planCounts: Record<string, number>;
  };
  reports: {
    total: number;
    pending: number;
    recentCount: number;
  };
  trials?: TrialStats;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch main stats and trial stats in parallel
      const [statsRes, trialsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/trials/stats'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');

      const statsData = await statsRes.json();
      const trialsData = trialsRes.ok ? await trialsRes.json() : null;

      setStats({
        ...statsData.data,
        trials: trialsData?.data?.stats || null,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="h-8 w-8 text-red-400" />
          Admin Dashboard
        </h1>
        <p className="text-slate-400 mt-1">
          Overview of system statistics and management
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats?.users.totalUsers || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Active Subscriptions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {stats?.users.activeSubscriptions || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Paying customers</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Beta Users
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {stats?.users.betaUsers || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Granted access</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Suspended
            </CardTitle>
            <Ban className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {stats?.users.suspendedUsers || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Blocked accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Module Reports
            </CardTitle>
            <FileWarning className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats?.reports.total || 0}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {(stats?.reports.pending || 0) > 0 && (
                <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded">
                  {stats?.reports.pending} pending
                </span>
              )}
              <span className="text-xs text-slate-400">
                {stats?.reports.recentCount || 0} this week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Plan Distribution
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.users.planCounts && Object.entries(stats.users.planCounts).length > 0 ? (
                Object.entries(stats.users.planCounts).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 capitalize">{plan}</span>
                    <span className="font-medium text-white">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No active plans</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              System Health
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">Healthy</div>
            <p className="text-xs text-slate-400 mt-1">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Trial Stats */}
      {stats?.trials && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  Device Trials
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Zero-friction trial tracking
                </CardDescription>
              </div>
              <Link href="/admin/trials">
                <Button variant="outline" size="sm" className="border-slate-700">
                  Manage Trials
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400 text-xs">Active Anonymous</p>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  {stats.trials.activeAnonymous}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Github className="h-3 w-3" /> Extended
                </p>
                <p className="text-xl font-bold text-green-400 mt-1">
                  {stats.trials.activeExtended}
                </p>
                <p className="text-xs text-slate-500">{stats.trials.extensionRate}% rate</p>
              </div>
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400 text-xs">Converted</p>
                <p className="text-xl font-bold text-purple-400 mt-1">
                  {stats.trials.convertedTrials}
                </p>
                <p className="text-xs text-slate-500">{stats.trials.conversionRate}% rate</p>
              </div>
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400 text-xs">Flagged</p>
                <p className="text-xl font-bold text-red-400 mt-1">
                  {stats.trials.flaggedDevices}
                </p>
              </div>
            </div>
            {(stats.trials.expiringToday > 0 || stats.trials.expiringThisWeek > 0) && (
              <div className="mt-4 pt-4 border-t border-slate-700 flex gap-4">
                {stats.trials.expiringToday > 0 && (
                  <span className="text-amber-400 text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {stats.trials.expiringToday} expiring today
                  </span>
                )}
                {stats.trials.expiringThisWeek > 0 && (
                  <span className="text-slate-400 text-sm">
                    {stats.trials.expiringThisWeek} this week
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">User Management</CardTitle>
            <CardDescription className="text-slate-400">
              Manage users, subscriptions, and access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/users">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  View All Users
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400">Free Trial Users</p>
                <p className="text-xl font-bold text-white mt-1">
                  {(stats?.users.totalUsers || 0) -
                    (stats?.users.activeSubscriptions || 0) -
                    (stats?.users.betaUsers || 0)}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400">Conversion Rate</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats?.users.totalUsers
                    ? Math.round(
                        ((stats.users.activeSubscriptions || 0) /
                          stats.users.totalUsers) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Module Reports</CardTitle>
            <CardDescription className="text-slate-400">
              Track and resolve outdated module reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/reports">
              <Button
                className={`w-full justify-between ${
                  (stats?.reports.pending || 0) > 0
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  {(stats?.reports.pending || 0) > 0
                    ? `Review ${stats?.reports.pending} Pending`
                    : 'View All Reports'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400">Total Reports</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats?.reports.total || 0}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded p-3">
                <p className="text-slate-400">This Week</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats?.reports.recentCount || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
