'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  GitBranch,
  Users,
  FileCode,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface EngineeringSession {
  id: string;
  teamId: string;
  projectHash: string;
  projectName: string;
  currentPhase: string;
  currentAgent: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  phaseHistory: {
    phase: string;
    startedAt: string;
    completedAt: string | null;
    agent: string;
  }[];
  decisionsCount: number;
  artifactsCount: number;
  dependencyNodesCount: number;
}

interface EngineeringStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  pausedSessions: number;
  abandonedSessions: number;
  sessionsToday: number;
  sessionsThisWeek: number;
  averageCompletionTime: number; // minutes
  phaseDistribution: Record<string, number>;
  agentUsage: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const PHASE_COLORS: Record<string, string> = {
  scoping: 'bg-blue-600',
  requirements: 'bg-indigo-600',
  architecture: 'bg-purple-600',
  design_review: 'bg-pink-600',
  implementation: 'bg-amber-600',
  code_review: 'bg-orange-600',
  testing: 'bg-yellow-600',
  security_review: 'bg-red-600',
  documentation: 'bg-teal-600',
  staging: 'bg-cyan-600',
  launch: 'bg-green-600',
};

const AGENT_ICONS: Record<string, string> = {
  orchestrator: '🎯',
  pm: '📋',
  architect: '🏗️',
  engineer: '💻',
  qa: '🧪',
  security: '🔒',
  documentation: '📝',
  devops: '🚀',
};

export default function AdminEngineeringPage() {
  const [sessions, setSessions] = useState<EngineeringSession[]>([]);
  const [stats, setStats] = useState<EngineeringStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<EngineeringSession | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (phaseFilter !== 'all') params.set('phase', phaseFilter);

      const response = await fetch(`/api/admin/engineering/sessions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data.data.sessions);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Failed to load engineering sessions');
    }
  }, [page, statusFilter, phaseFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/engineering/stats');
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600';
      case 'paused':
        return 'bg-yellow-600';
      case 'completed':
        return 'bg-blue-600';
      case 'abandoned':
        return 'bg-red-600';
      default:
        return 'bg-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-3 w-3" />;
      case 'paused':
        return <Pause className="h-3 w-3" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'abandoned':
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Session action handlers
  const handlePauseSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/engineering/sessions/${sessionId}/pause`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.data?.error || 'Failed to pause session');
      }
      toast.success('Session paused');
      await fetchSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pause session');
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/engineering/sessions/${sessionId}/resume`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.data?.error || 'Failed to resume session');
      }
      toast.success('Session resumed');
      await fetchSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume session');
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to cancel this session? This cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/engineering/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.data?.error || 'Failed to cancel session');
      }
      toast.success('Session cancelled');
      await fetchSessions();
      if (selectedSession?.id === sessionId) {
        setDetailDialogOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel session');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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
            <Cpu className="h-8 w-8 text-purple-400" />
            Engineering Projects
          </h1>
          <p className="text-slate-400 mt-1">
            Monitor AI agent-driven engineering sessions
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
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Active Now
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {stats.activeSessions}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {stats.completedSessions}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">
                {stats.sessionsThisWeek}
              </div>
              <p className="text-xs text-slate-400">{stats.sessionsToday} today</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Avg Completion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">
                {formatDuration(stats.averageCompletionTime)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase & Agent Distribution */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Phase Distribution</CardTitle>
              <CardDescription className="text-slate-400">
                Active sessions by current phase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.phaseDistribution).map(([phase, count]) => (
                  <div key={phase} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={PHASE_COLORS[phase] || 'bg-slate-600'}>
                        {phase.replace('_', ' ')}
                      </Badge>
                    </div>
                    <span className="text-white font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.phaseDistribution).length === 0 && (
                  <p className="text-slate-400 text-sm">No active sessions</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Agent Activity</CardTitle>
              <CardDescription className="text-slate-400">
                Which agents are working
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.agentUsage).map(([agent, count]) => (
                  <div key={agent} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{AGENT_ICONS[agent] || '🤖'}</span>
                      <span className="text-slate-300 capitalize">{agent}</span>
                    </div>
                    <span className="text-white font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(stats.agentUsage).length === 0 && (
                  <p className="text-slate-400 text-sm">No active agents</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Phase:</span>
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  <SelectItem value="scoping">Scoping</SelectItem>
                  <SelectItem value="requirements">Requirements</SelectItem>
                  <SelectItem value="architecture">Architecture</SelectItem>
                  <SelectItem value="implementation">Implementation</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="security_review">Security Review</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="launch">Launch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">Project</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Phase</TableHead>
              <TableHead className="text-slate-400">Current Agent</TableHead>
              <TableHead className="text-slate-400">Last Activity</TableHead>
              <TableHead className="text-slate-400">Progress</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-slate-400">
                    <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No engineering sessions found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id} className="border-slate-700">
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">{session.projectName}</p>
                      <p className="text-slate-400 text-xs font-mono">
                        {session.projectHash.substring(0, 8)}...
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(session.status)} flex items-center gap-1 w-fit`}>
                      {getStatusIcon(session.status)}
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={PHASE_COLORS[session.currentPhase] || 'bg-slate-600'}>
                      {session.currentPhase.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{AGENT_ICONS[session.currentAgent] || '🤖'}</span>
                      <span className="text-slate-300 capitalize">{session.currentAgent}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-slate-300">
                        {getTimeSince(session.lastActivityAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileCode className="h-3 w-3" />
                        {session.artifactsCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {session.dependencyNodesCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.decisionsCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {session.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePauseSession(session.id)}
                          className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                          title="Pause session"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {session.status === 'paused' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResumeSession(session.id)}
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                          title="Resume session"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {(session.status === 'active' || session.status === 'paused') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelSession(session.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          title="Cancel session"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSession(session);
                          setDetailDialogOpen(true);
                        }}
                        className="text-slate-400 hover:text-white"
                        title="View details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
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

      {/* Session Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-400" />
              {selectedSession?.projectName}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Session details and phase history
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-6 py-4">
              {/* Status Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge className={`${getStatusColor(selectedSession.status)} flex items-center gap-1`}>
                    {getStatusIcon(selectedSession.status)}
                    {selectedSession.status}
                  </Badge>
                  <span className="text-slate-400 text-sm">
                    Started {formatDate(selectedSession.startedAt)}
                  </span>
                  {selectedSession.completedAt && (
                    <span className="text-green-400 text-sm">
                      Completed {formatDate(selectedSession.completedAt)}
                    </span>
                  )}
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {selectedSession.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePauseSession(selectedSession.id)}
                      className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/20"
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  {selectedSession.status === 'paused' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResumeSession(selectedSession.id)}
                      className="border-green-600 text-green-400 hover:bg-green-900/20"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  )}
                  {(selectedSession.status === 'active' || selectedSession.status === 'paused') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelSession(selectedSession.id)}
                      className="border-red-600 text-red-400 hover:bg-red-900/20"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Current State */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Current State</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-xs">Phase</p>
                    <Badge className={PHASE_COLORS[selectedSession.currentPhase] || 'bg-slate-600'}>
                      {selectedSession.currentPhase.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Agent</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg">{AGENT_ICONS[selectedSession.currentAgent] || '🤖'}</span>
                      <span className="text-white capitalize">{selectedSession.currentAgent}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <FileCode className="h-5 w-5 mx-auto text-blue-400" />
                  <p className="text-2xl font-bold text-white mt-1">{selectedSession.artifactsCount}</p>
                  <p className="text-xs text-slate-400">Artifacts</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <GitBranch className="h-5 w-5 mx-auto text-green-400" />
                  <p className="text-2xl font-bold text-white mt-1">{selectedSession.dependencyNodesCount}</p>
                  <p className="text-xs text-slate-400">Dependencies</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <Users className="h-5 w-5 mx-auto text-purple-400" />
                  <p className="text-2xl font-bold text-white mt-1">{selectedSession.decisionsCount}</p>
                  <p className="text-xs text-slate-400">Decisions</p>
                </div>
              </div>

              {/* Phase History */}
              <div>
                <h4 className="text-white font-medium mb-3">Phase History</h4>
                <div className="space-y-2">
                  {selectedSession.phaseHistory.map((ph, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-slate-800 rounded p-2"
                    >
                      <Badge className={PHASE_COLORS[ph.phase] || 'bg-slate-600'}>
                        {ph.phase.replace('_', ' ')}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-slate-600" />
                      <span className="text-lg">{AGENT_ICONS[ph.agent] || '🤖'}</span>
                      <span className="text-slate-400 text-xs">
                        {formatDate(ph.startedAt)}
                        {ph.completedAt && ` - ${formatDate(ph.completedAt)}`}
                      </span>
                      {ph.completedAt && (
                        <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />
                      )}
                    </div>
                  ))}
                  {selectedSession.phaseHistory.length === 0 && (
                    <p className="text-slate-400 text-sm">No phase history yet</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
