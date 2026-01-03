'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Search,
  Loader2,
  RefreshCw,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Subscription {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  status: string | null;
  provider: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paypalSubscriptionId: string | null;
  squareSubscriptionId: string | null;
  createdAt: string;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
}

interface FilterOption {
  value: string;
  count: number;
}

interface Filters {
  plans: FilterOption[];
  statuses: FilterOption[];
  providers: FilterOption[];
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface SubscriptionsData {
  subscriptions: Subscription[];
  pagination: Pagination;
  filters: Filters;
}

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'past_due':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'inactive':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getPlanColor = (plan: string | null) => {
  switch (plan) {
    case 'enterprise':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'agency':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'team':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'pro':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'beta':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getProviderUrl = (sub: Subscription) => {
  if (sub.provider === 'stripe' && sub.stripeCustomerId) {
    return `https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`;
  }
  if (sub.provider === 'paypal' && sub.paypalSubscriptionId) {
    return `https://www.paypal.com/billing/subscriptions/${sub.paypalSubscriptionId}`;
  }
  return null;
};

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const limit = 20;

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('offset', (currentPage * limit).toString());

      if (searchQuery) params.set('search', searchQuery);
      if (selectedStatus) params.set('status', selectedStatus);
      if (selectedPlan) params.set('plan', selectedPlan);
      if (selectedProvider) params.set('provider', selectedProvider);

      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, searchQuery, selectedStatus, selectedPlan, selectedProvider]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchData();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus(null);
    setSelectedPlan(null);
    setSelectedProvider(null);
    setCurrentPage(0);
  };

  const hasActiveFilters = searchQuery || selectedStatus || selectedPlan || selectedProvider;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.pagination.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-purple-400" />
            Subscriptions
          </h1>
          <p className="text-slate-400 mt-1">
            Manage team subscriptions and billing
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

      {/* Filter Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total</p>
                <p className="text-2xl font-bold text-white">{data?.pagination.total || 0}</p>
              </div>
              <CreditCard className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        {data?.filters.statuses.map((status) => (
          <Card
            key={status.value}
            className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all ${
              selectedStatus === status.value ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => {
              setSelectedStatus(selectedStatus === status.value ? null : status.value);
              setCurrentPage(0);
            }}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 capitalize">{status.value}</p>
                  <p className="text-2xl font-bold text-white">{status.count}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(status.value)}`}>
                  {status.value}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by team name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
            </form>

            {/* Plan Filter */}
            <select
              value={selectedPlan || ''}
              onChange={(e) => {
                setSelectedPlan(e.target.value || null);
                setCurrentPage(0);
              }}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white"
            >
              <option value="">All Plans</option>
              {data?.filters.plans.map((plan) => (
                <option key={plan.value} value={plan.value}>
                  {plan.value} ({plan.count})
                </option>
              ))}
            </select>

            {/* Provider Filter */}
            <select
              value={selectedProvider || ''}
              onChange={(e) => {
                setSelectedProvider(e.target.value || null);
                setCurrentPage(0);
              }}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white"
            >
              <option value="">All Providers</option>
              {data?.filters.providers.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.value} ({provider.count})
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Subscriptions</CardTitle>
          <CardDescription className="text-slate-400">
            {data?.pagination.total || 0} subscriptions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.subscriptions && data.subscriptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Team</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Owner</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Plan</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Provider</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Created</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{sub.name}</p>
                          <p className="text-slate-400 text-sm">{sub.slug}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white">{sub.ownerName || 'Unknown'}</p>
                          <p className="text-slate-400 text-sm">{sub.ownerEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs border capitalize ${getPlanColor(sub.plan)}`}>
                          {sub.plan || 'none'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(sub.status)}`}>
                          {sub.status || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 capitalize">{sub.provider || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Calendar className="h-3 w-3" />
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {getProviderUrl(sub) && (
                          <a
                            href={getProviderUrl(sub)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No subscriptions found</p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                Showing {currentPage * limit + 1} to{' '}
                {Math.min((currentPage + 1) * limit, data?.pagination.total || 0)} of{' '}
                {data?.pagination.total || 0}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="border-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-slate-400 text-sm">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!data?.pagination.hasMore}
                  className="border-slate-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
