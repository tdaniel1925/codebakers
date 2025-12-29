'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Github,
  Flag,
  Ban,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Monitor,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface TrialStatus {
  stage: string;
  daysRemaining: number;
  isExpired: boolean;
  canExtend: boolean;
}

interface Trial {
  id: string;
  deviceHash: string;
  machineId: string | null;
  githubId: string | null;
  githubUsername: string | null;
  email: string | null;
  ipAddress: string | null;
  trialStage: string;
  trialStartedAt: string;
  trialExtendedAt: string | null;
  trialExpiresAt: string | null;
  projectId: string | null;
  projectName: string | null;
  flagged: boolean;
  flagReason: string | null;
  platform: string | null;
  createdAt: string;
  status: TrialStatus;
}

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminTrialsPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [flaggedFilter, setFlaggedFilter] = useState<string>('all');
  const [expiringSoonFilter, setExpiringSoonFilter] = useState(false);
  const [page, setPage] = useState(1);

  // Flag dialog state
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTrials = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });

      if (stageFilter !== 'all') params.set('stage', stageFilter);
      if (flaggedFilter !== 'all') params.set('flagged', flaggedFilter);
      if (expiringSoonFilter) params.set('expiringSoon', 'true');

      const response = await fetch(`/api/admin/trials?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trials');
      const data = await response.json();
      setTrials(data.data.trials);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Failed to load trials:', error);
      toast.error('Failed to load trials');
    }
  }, [page, stageFilter, flaggedFilter, expiringSoonFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/trials/stats');
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
      await Promise.all([fetchTrials(), fetchStats()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchTrials, fetchStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchTrials(), fetchStats()]);
    setIsRefreshing(false);
  };

  const handleFlag = async () => {
    if (!selectedTrial || !flagReason.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/trials/${selectedTrial.id}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: flagReason }),
      });

      if (!response.ok) throw new Error('Failed to flag trial');

      toast.success('Trial flagged successfully');
      setFlagDialogOpen(false);
      setSelectedTrial(null);
      setFlagReason('');
      await fetchTrials();
    } catch (error) {
      toast.error('Failed to flag trial');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnflag = async (trialId: string) => {
    try {
      const response = await fetch(`/api/admin/trials/${trialId}/flag`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to unflag trial');

      toast.success('Trial unflagged successfully');
      await fetchTrials();
    } catch (error) {
      toast.error('Failed to unflag trial');
    }
  };

  const handleExpire = async (trialId: string) => {
    if (!confirm('Force expire this trial? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/trials/${trialId}/expire`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to expire trial');

      toast.success('Trial expired successfully');
      await fetchTrials();
    } catch (error) {
      toast.error('Failed to expire trial');
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'anonymous':
        return 'bg-blue-600';
      case 'extended':
        return 'bg-green-600';
      case 'expired':
        return 'bg-red-600';
      case 'converted':
        return 'bg-purple-600';
      default:
        return 'bg-slate-600';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
            <Clock className="h-8 w-8 text-blue-400" />
            Trial Management
          </h1>
          <p className="text-slate-400 mt-1">
            Manage device trials and track conversion funnel
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Total Trials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalTrials}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Anonymous
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {stats.activeAnonymous}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Extended (GitHub)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {stats.activeExtended}
              </div>
              <p className="text-xs text-slate-400">{stats.extensionRate}% rate</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Converted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">
                {stats.convertedTrials}
              </div>
              <p className="text-xs text-slate-400">{stats.conversionRate}% rate</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Flagged
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {stats.flaggedDevices}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Urgent Stats */}
      {stats && (stats.expiringToday > 0 || stats.expiringThisWeek > 0) && (
        <div className="flex gap-4">
          {stats.expiringToday > 0 && (
            <Card className="bg-amber-900/30 border-amber-700 flex-1">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-amber-400 font-medium">
                    {stats.expiringToday} trial{stats.expiringToday !== 1 ? 's' : ''} expiring today
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.expiringThisWeek > 0 && (
            <Card className="bg-slate-800/50 border-slate-700 flex-1">
              <CardContent className="flex items-center gap-3 py-4">
                <Calendar className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-slate-300">
                    {stats.expiringThisWeek} trial{stats.expiringThisWeek !== 1 ? 's' : ''} expiring this week
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-slate-400">Stage:</Label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="anonymous">Anonymous</SelectItem>
                  <SelectItem value="extended">Extended</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-slate-400">Flagged:</Label>
              <Select value={flaggedFilter} onValueChange={setFlaggedFilter}>
                <SelectTrigger className="w-[120px] bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Flagged</SelectItem>
                  <SelectItem value="false">Not Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={expiringSoonFilter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExpiringSoonFilter(!expiringSoonFilter)}
              className={expiringSoonFilter ? 'bg-amber-600' : 'border-slate-700'}
            >
              <Clock className="h-4 w-4 mr-1" />
              Expiring Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trials Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">Device</TableHead>
              <TableHead className="text-slate-400">Stage</TableHead>
              <TableHead className="text-slate-400">GitHub</TableHead>
              <TableHead className="text-slate-400">Project</TableHead>
              <TableHead className="text-slate-400">Expires</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trials.map((trial) => (
              <TableRow key={trial.id} className="border-slate-700">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-white font-mono text-xs">
                        {trial.deviceHash.substring(0, 12)}...
                      </p>
                      {trial.platform && (
                        <p className="text-slate-400 text-xs">{trial.platform}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getStageColor(trial.trialStage)}>
                    {trial.trialStage}
                  </Badge>
                </TableCell>
                <TableCell>
                  {trial.githubUsername ? (
                    <div className="flex items-center gap-1 text-green-400">
                      <Github className="h-4 w-4" />
                      <span className="text-sm">@{trial.githubUsername}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {trial.projectName ? (
                    <span className="text-sm text-slate-300 truncate max-w-[150px] block">
                      {trial.projectName}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className={trial.status.isExpired ? 'text-red-400' : 'text-slate-300'}>
                      {formatDate(trial.trialExpiresAt)}
                    </span>
                    {!trial.status.isExpired && trial.status.daysRemaining <= 2 && (
                      <span className="text-amber-400 text-xs ml-1">
                        ({trial.status.daysRemaining}d)
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {trial.flagged ? (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">Flagged</span>
                      </div>
                    ) : trial.status.isExpired ? (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs">Expired</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">Active</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {trial.flagged ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnflag(trial.id)}
                        className="text-green-400 hover:text-green-300"
                      >
                        Unflag
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTrial(trial);
                          setFlagDialogOpen(true);
                        }}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    )}
                    {!trial.status.isExpired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExpire(trial.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <CardContent className="border-t border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="border-slate-700"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(page + 1)}
                  className="border-slate-700"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Flag Dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Flag Trial for Abuse</DialogTitle>
            <DialogDescription className="text-slate-400">
              Flag this device to prevent future trial access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Reason</Label>
              <Input
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., Multiple trial abuse, suspicious activity"
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFlagDialogOpen(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFlag}
              disabled={isSubmitting || !flagReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Flagging...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Flag Trial
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
