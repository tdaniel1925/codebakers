'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  Calendar,
  Receipt,
  Minus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PlanBreakdown {
  plan: string;
  count: number;
  revenue: number;
}

interface ProviderBreakdown {
  provider: string;
  count: number;
}

interface ThirtyDayStats {
  newSubscriptions: number;
  cancellations: number;
  payments: number;
  refunds: number;
  revenue: number;
  churnRate: number;
  growthRate: number;
  netGrowth: number;
}

interface RecentEvent {
  id: string;
  type: string;
  provider: string;
  amount: number | null;
  plan: string | null;
  createdAt: string;
}

interface RevenueData {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  planBreakdown: PlanBreakdown[];
  providerBreakdown: ProviderBreakdown[];
  thirtyDayStats: ThirtyDayStats;
  recentEvents: RecentEvent[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatEventType = (type: string) => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getEventColor = (type: string) => {
  if (type.includes('completed') || type.includes('activated') || type.includes('created')) {
    return 'text-green-400';
  }
  if (type.includes('cancelled') || type.includes('expired') || type.includes('failed')) {
    return 'text-red-400';
  }
  if (type.includes('refunded')) {
    return 'text-orange-400';
  }
  return 'text-blue-400';
};

const getPlanColor = (plan: string) => {
  const colors: Record<string, string> = {
    pro: 'bg-blue-500',
    team: 'bg-purple-500',
    agency: 'bg-orange-500',
    enterprise: 'bg-green-500',
  };
  return colors[plan] || 'bg-slate-500';
};

export default function RevenueDashboardPage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/revenue');
      if (!res.ok) throw new Error('Failed to fetch revenue data');
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error('Failed to load revenue data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalPlanRevenue = data?.planBreakdown?.reduce((sum, p) => sum + p.revenue, 0) || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-400" />
            Revenue Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Track subscriptions, payments, and revenue metrics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="border-slate-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Primary Revenue Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Monthly Recurring Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(data?.mrr || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">MRR from active subscriptions</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Annual Recurring Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {formatCurrency(data?.arr || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Projected yearly revenue</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Active Subscribers
            </CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {data?.activeSubscribers || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Paying customers</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Avg Revenue Per User
            </CardTitle>
            <CreditCard className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {formatCurrency(
                data?.activeSubscribers
                  ? (data.mrr || 0) / data.activeSubscribers
                  : 0
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">ARPU monthly</p>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Performance Stats */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <div>
              <CardTitle className="text-white">30-Day Performance</CardTitle>
              <CardDescription className="text-slate-400">
                Recent subscription and payment activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded p-4">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <ArrowUp className="h-3 w-3 text-green-400" /> New Subscriptions
              </p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {data?.thirtyDayStats?.newSubscriptions || 0}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded p-4">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <ArrowDown className="h-3 w-3 text-red-400" /> Cancellations
              </p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                {data?.thirtyDayStats?.cancellations || 0}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded p-4">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <Receipt className="h-3 w-3 text-blue-400" /> Payments
              </p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {data?.thirtyDayStats?.payments || 0}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded p-4">
              <p className="text-slate-400 text-xs">Revenue (30d)</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {formatCurrency(data?.thirtyDayStats?.revenue || 0)}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Churn Rate</p>
              <p className={`text-xl font-bold mt-1 ${
                (data?.thirtyDayStats?.churnRate || 0) > 5 ? 'text-red-400' : 'text-green-400'
              }`}>
                {data?.thirtyDayStats?.churnRate || 0}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">Growth Rate</p>
              <p className={`text-xl font-bold mt-1 ${
                (data?.thirtyDayStats?.growthRate || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(data?.thirtyDayStats?.growthRate || 0) >= 0 ? '+' : ''}
                {data?.thirtyDayStats?.growthRate || 0}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">Net Growth</p>
              <p className={`text-xl font-bold mt-1 flex items-center justify-center gap-1 ${
                (data?.thirtyDayStats?.netGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(data?.thirtyDayStats?.netGrowth || 0) > 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (data?.thirtyDayStats?.netGrowth || 0) < 0 ? (
                  <ArrowDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {Math.abs(data?.thirtyDayStats?.netGrowth || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Breakdown and Provider Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Plan Breakdown */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Revenue by Plan</CardTitle>
            <CardDescription className="text-slate-400">
              MRR breakdown by subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.planBreakdown && data.planBreakdown.length > 0 ? (
              <div className="space-y-4">
                {data.planBreakdown.map((plan) => {
                  const percentage = totalPlanRevenue > 0
                    ? (plan.revenue / totalPlanRevenue) * 100
                    : 0;
                  return (
                    <div key={plan.plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white capitalize font-medium">{plan.plan}</span>
                        <div className="text-right">
                          <span className="text-green-400 font-bold">
                            {formatCurrency(plan.revenue)}
                          </span>
                          <span className="text-slate-400 text-sm ml-2">
                            ({plan.count} users)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className={`${getPlanColor(plan.plan)} h-2 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No active subscriptions</p>
            )}
          </CardContent>
        </Card>

        {/* Provider Breakdown */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Payment Providers</CardTitle>
            <CardDescription className="text-slate-400">
              Active subscriptions by provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.providerBreakdown && data.providerBreakdown.length > 0 ? (
              <div className="space-y-3">
                {data.providerBreakdown.map((provider) => {
                  const totalProviders = data.providerBreakdown.reduce(
                    (sum, p) => sum + p.count,
                    0
                  );
                  const percentage = totalProviders > 0
                    ? (provider.count / totalProviders) * 100
                    : 0;
                  return (
                    <div key={provider.provider} className="bg-slate-900/50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white capitalize font-medium">
                          {provider.provider}
                        </span>
                        <span className="text-slate-300">
                          {provider.count} subscribers ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No payment data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payment Events */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Payment Events</CardTitle>
          <CardDescription className="text-slate-400">
            Latest subscription and payment activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.recentEvents && data.recentEvents.length > 0 ? (
            <div className="space-y-2">
              {data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between bg-slate-900/50 rounded p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-slate-800 ${getEventColor(event.type)}`}>
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={`font-medium ${getEventColor(event.type)}`}>
                        {formatEventType(event.type)}
                      </p>
                      <p className="text-sm text-slate-400">
                        {event.plan && <span className="capitalize">{event.plan}</span>}
                        {event.plan && event.provider && ' via '}
                        {event.provider && <span className="capitalize">{event.provider}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {event.amount !== null && (
                      <p className="text-white font-medium">
                        {formatCurrency(event.amount)}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      {new Date(event.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-4">No recent events</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
