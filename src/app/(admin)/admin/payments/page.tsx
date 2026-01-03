'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Search,
  Loader2,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PaymentEvent {
  id: string;
  eventType: string;
  provider: string;
  providerEventId: string | null;
  amount: number | null;
  currency: string | null;
  plan: string | null;
  metadata: unknown;
  createdAt: string;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  profileId: string | null;
  profileEmail: string | null;
  profileName: string | null;
}

interface EventTypeStat {
  type: string;
  count: number;
  totalAmount: number;
}

interface ProviderStat {
  provider: string;
  count: number;
}

interface ThirtyDaySummary {
  totalEvents: number;
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
}

interface Stats {
  eventTypes: EventTypeStat[];
  providers: ProviderStat[];
  thirtyDaySummary: ThirtyDaySummary;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface PaymentsData {
  events: PaymentEvent[];
  pagination: Pagination;
  stats: Stats;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatEventType = (type: string) => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getEventIcon = (type: string) => {
  if (type.includes('payment_completed') || type.includes('invoice_paid')) {
    return <ArrowDownLeft className="h-4 w-4 text-green-400" />;
  }
  if (type.includes('refunded')) {
    return <ArrowUpRight className="h-4 w-4 text-orange-400" />;
  }
  if (type.includes('failed')) {
    return <X className="h-4 w-4 text-red-400" />;
  }
  return <Receipt className="h-4 w-4 text-blue-400" />;
};

const getEventColor = (type: string) => {
  if (type.includes('completed') || type.includes('activated') || type.includes('paid')) {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
  if (type.includes('cancelled') || type.includes('expired') || type.includes('failed')) {
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
  if (type.includes('refunded')) {
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  }
  if (type.includes('created') || type.includes('started')) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
};

export default function PaymentsHistoryPage() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const limit = 25;

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('offset', (currentPage * limit).toString());

      if (searchQuery) params.set('search', searchQuery);
      if (selectedEventType) params.set('eventType', selectedEventType);
      if (selectedProvider) params.set('provider', selectedProvider);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch payments');
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, searchQuery, selectedEventType, selectedProvider, dateFrom, dateTo]);

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
    setSelectedEventType(null);
    setSelectedProvider(null);
    setDateFrom('');
    setDateTo('');
    setCurrentPage(0);
  };

  const hasActiveFilters = searchQuery || selectedEventType || selectedProvider || dateFrom || dateTo;

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
            <Receipt className="h-8 w-8 text-blue-400" />
            Payment History
          </h1>
          <p className="text-slate-400 mt-1">
            All payment and subscription events
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

      {/* 30-Day Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">30-Day Events</p>
                <p className="text-2xl font-bold text-white">
                  {data?.stats.thirtyDaySummary.totalEvents || 0}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">30-Day Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(data?.stats.thirtyDaySummary.totalRevenue || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">30-Day Refunds</p>
                <p className="text-2xl font-bold text-orange-400">
                  {formatCurrency(data?.stats.thirtyDaySummary.totalRefunds || 0)}
                </p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Net Revenue</p>
                <p className="text-2xl font-bold text-purple-400">
                  {formatCurrency(data?.stats.thirtyDaySummary.netRevenue || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by team name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
            </form>

            {/* Event Type Filter */}
            <select
              value={selectedEventType || ''}
              onChange={(e) => {
                setSelectedEventType(e.target.value || null);
                setCurrentPage(0);
              }}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white"
            >
              <option value="">All Event Types</option>
              {data?.stats.eventTypes.map((et) => (
                <option key={et.type} value={et.type}>
                  {formatEventType(et.type)} ({et.count})
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
              {data?.stats.providers.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.provider} ({p.count})
                </option>
              ))}
            </select>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(0);
                }}
                className="bg-slate-900/50 border-slate-700 text-white"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(0);
                }}
                className="bg-slate-900/50 border-slate-700 text-white"
              />
            </div>

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

      {/* Events List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Payment Events</CardTitle>
          <CardDescription className="text-slate-400">
            {data?.pagination.total || 0} events found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.events && data.events.length > 0 ? (
            <div className="space-y-3">
              {data.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-slate-800">
                      {getEventIcon(event.eventType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs border ${getEventColor(event.eventType)}`}>
                          {formatEventType(event.eventType)}
                        </span>
                        {event.plan && (
                          <span className="text-slate-400 text-sm capitalize">
                            {event.plan}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm">
                        {event.teamName ? (
                          <span className="text-white">{event.teamName}</span>
                        ) : event.profileName ? (
                          <span className="text-white">{event.profileName}</span>
                        ) : (
                          <span className="text-slate-400">Unknown</span>
                        )}
                        {event.profileEmail && (
                          <span className="text-slate-400 ml-2">({event.profileEmail})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      {event.amount !== null && (
                        <p className={`font-bold ${
                          event.eventType.includes('refunded') ? 'text-orange-400' : 'text-green-400'
                        }`}>
                          {event.eventType.includes('refunded') ? '-' : '+'}
                          {formatCurrency(event.amount)}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 capitalize">
                        {event.provider}
                      </p>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <div className="flex items-center gap-1 text-slate-300 text-sm">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.createdAt).toLocaleDateString()}
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No payment events found</p>
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
