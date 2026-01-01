'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  FileCode,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface EnforcementSession {
  id: string;
  teamId: string | null;
  apiKeyId: string | null;
  sessionToken: string;
  projectHash: string | null;
  projectName: string | null;
  taskDescription: string | null;
  status: 'active' | 'completed' | 'expired' | 'failed';
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  teamName: string | null;
  discoveryCount: number;
  validationCount: number;
  passedCount: number;
}

interface EnforcementStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  expiredSessions: number;
  sessionsToday: number;
  sessionsThisWeek: number;
  totalDiscoveries: number;
  totalValidations: number;
  passedValidations: number;
  failedValidations: number;
  passRate: number;
  uniqueProjects: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminEnforcementPage() {
  const [sessions, setSessions] = useState<EnforcementSession[]>([]);
  const [stats, setStats] = useState<EnforcementStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/enforcement?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data.data.sessions);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Failed to load enforcement sessions');
    }
  }, [page, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/enforcement/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchSessions(), fetchStats()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchSessions, fetchStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSessions(), fetchStats()]);
    setIsRefreshing(false);
    toast.success('Data refreshed');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'completed':
        return <Badge className="bg-blue-600">Completed</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-600">Expired</Badge>;
      case 'failed':
        return <Badge className="bg-red-600">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const truncateToken = (token: string) => {
    return `${token.slice(0, 8)}...${token.slice(-8)}`;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Lock className="h-8 w-8 text-purple-400" />
            v6.0 Enforcement Sessions
          </h1>
          <p className="text-slate-400 mt-1">
            Track pattern discovery and validation sessions
          </p>
        </div>
        <Button
          variant="outline"
          className="border-slate-700"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Total Sessions
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
              <p className="text-xs text-slate-400 mt-1">
                {stats.sessionsToday} today, {stats.sessionsThisWeek} this week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Active Sessions
              </CardTitle>
              <Clock className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{stats.activeSessions}</div>
              <p className="text-xs text-slate-400 mt-1">Currently in progress</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Pass Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">{stats.passRate}%</div>
              <p className="text-xs text-slate-400 mt-1">
                {stats.passedValidations}/{stats.totalValidations} validations
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Unique Projects
              </CardTitle>
              <FileCode className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">{stats.uniqueProjects}</div>
              <p className="text-xs text-slate-400 mt-1">Using enforcement</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Sessions</CardTitle>
          <CardDescription className="text-slate-400">
            Browse and filter enforcement sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search project name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-64 bg-slate-900/50 border-slate-700"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 bg-slate-900/50 border-slate-700">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sessions Table */}
          <div className="rounded-md border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Project</TableHead>
                  <TableHead className="text-slate-300">Team</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Discoveries</TableHead>
                  <TableHead className="text-slate-300">Validations</TableHead>
                  <TableHead className="text-slate-300">Created</TableHead>
                  <TableHead className="text-slate-300">Token</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                      No enforcement sessions found
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">
                        {session.projectName || 'Unknown Project'}
                        {session.taskDescription && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                            {session.taskDescription}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {session.teamName || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="text-slate-300">
                        {session.discoveryCount}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          {session.passedCount > 0 && (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          )}
                          {session.validationCount - session.passedCount > 0 && (
                            <XCircle className="h-3 w-3 text-red-400" />
                          )}
                          <span className="text-slate-300">
                            {session.passedCount}/{session.validationCount}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDate(session.createdAt)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs font-mono">
                        {truncateToken(session.sessionToken)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} sessions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-slate-300 text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Validations Alert */}
      {stats && stats.failedValidations > 0 && (
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Failed Validations
            </CardTitle>
            <CardDescription className="text-red-300/70">
              {stats.failedValidations} validations have failed. These indicate AI-generated code
              that didn't pass tests or TypeScript checks.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
