'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Code,
  Shield,
  BookOpen,
  Rocket,
  Users,
  Cpu,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Zap,
  Loader2,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EngineeringPhase } from '@/lib/engineering-types';

interface PhaseProgress {
  phase: string;
  displayName: string;
  description: string;
  agent: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
  passedAt: string | null;
  failedReason: string | null;
  isCurrent: boolean;
}

interface Message {
  id: string;
  fromAgent: string;
  toAgent: string;
  messageType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date | null;
}

interface SessionData {
  id: string;
  teamId: string;
  projectHash: string;
  projectName: string;
  projectDescription: string | null;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  currentPhase: EngineeringPhase;
  currentPhaseDisplay: string;
  currentPhaseDescription: string;
  currentAgent: string;
  isRunning: boolean;
  progress: number;
  scope: Record<string, unknown> | null;
  stack: Record<string, unknown> | null;
  phaseProgress: PhaseProgress[];
  artifacts: {
    hasPrd: boolean;
    hasTechSpec: boolean;
    hasApiDocs: boolean;
    hasSecurityAudit: boolean;
    hasUserGuide: boolean;
    hasDeploymentGuide: boolean;
  };
  dependencyGraph: {
    nodeCount: number;
    edgeCount: number;
  };
  lastError: string | null;
  errorCount: number | null;
  totalApiCalls: number | null;
  totalTokensUsed: number | null;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
}

interface SessionDetailContentProps {
  session: SessionData;
  messages: Message[];
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <Play className="w-4 h-4 text-emerald-400" />;
    case 'paused':
      return <Pause className="w-4 h-4 text-amber-400" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-blue-400" />;
    case 'abandoned':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-neutral-400" />;
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'paused':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'completed':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'abandoned':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
  }
}

function getPhaseStatusIcon(status: string, isCurrent: boolean) {
  if (isCurrent) {
    return <Zap className="w-4 h-4 text-amber-400 animate-pulse" />;
  }
  switch (status) {
    case 'passed':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'in_progress':
      return <Play className="w-4 h-4 text-blue-400" />;
    case 'skipped':
      return <ChevronRight className="w-4 h-4 text-neutral-500" />;
    default:
      return <Clock className="w-4 h-4 text-neutral-600" />;
  }
}

function getAgentIcon(agent: string) {
  switch (agent) {
    case 'pm':
      return <Users className="w-4 h-4" />;
    case 'architect':
      return <Code className="w-4 h-4" />;
    case 'engineer':
      return <Cpu className="w-4 h-4" />;
    case 'qa':
      return <Shield className="w-4 h-4" />;
    case 'security':
      return <Shield className="w-4 h-4" />;
    case 'documentation':
      return <BookOpen className="w-4 h-4" />;
    case 'devops':
      return <Rocket className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
}

export function SessionDetailContent({ session: initialSession, messages: initialMessages }: SessionDetailContentProps) {
  const [session, setSession] = useState(initialSession);
  const [messages, setMessages] = useState(initialMessages);
  const [showMessages, setShowMessages] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);

  // SSE streaming for real-time updates
  useEffect(() => {
    if (session.status !== 'active' || !session.isRunning) return;

    const eventSource = new EventSource(`/api/engineering/sessions/${session.id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Update session state
        setSession(prev => ({
          ...prev,
          status: data.status,
          currentPhase: data.currentPhase,
          currentAgent: data.currentAgent,
          isRunning: data.isRunning,
          progress: data.progress,
          lastError: data.lastError,
          totalApiCalls: data.totalApiCalls,
          totalTokensUsed: data.totalTokensUsed,
          phaseProgress: prev.phaseProgress.map(p => {
            const updated = data.phases.find((dp: { phase: string }) => dp.phase === p.phase);
            if (updated) {
              return {
                ...p,
                status: updated.status,
                passedAt: updated.passedAt,
                isCurrent: data.currentPhase === p.phase,
              };
            }
            return p;
          }),
          artifacts: {
            ...prev.artifacts,
            hasPrd: data.artifacts?.hasPrd ?? prev.artifacts.hasPrd,
            hasTechSpec: data.artifacts?.hasTechSpec ?? prev.artifacts.hasTechSpec,
            hasSecurityAudit: data.artifacts?.hasSecurityAudit ?? prev.artifacts.hasSecurityAudit,
          },
        }));

        // Add new messages
        if (data.newMessages?.length > 0) {
          setLiveMessages(prev => [...prev, ...data.newMessages]);
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [session.id, session.status, session.isRunning]);

  // Start build
  const handleStartBuild = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/engineering/sessions/${session.id}/build`, {
        method: 'POST',
      });
      if (res.ok) {
        setSession(prev => ({ ...prev, isRunning: true, status: 'active' }));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to start build');
      }
    } catch (e) {
      alert('Failed to start build');
    } finally {
      setIsStarting(false);
    }
  }, [session.id]);

  // Stop build
  const handleStopBuild = useCallback(async () => {
    setIsStopping(true);
    try {
      const res = await fetch(`/api/engineering/sessions/${session.id}/build`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSession(prev => ({ ...prev, isRunning: false, status: 'paused' }));
      }
    } catch (e) {
      console.error('Failed to stop build:', e);
    } finally {
      setIsStopping(false);
    }
  }, [session.id]);

  // Combine initial messages with live messages
  const allMessages = [...messages, ...liveMessages];

  const artifactCount = [
    session.artifacts.hasPrd,
    session.artifacts.hasTechSpec,
    session.artifacts.hasApiDocs,
    session.artifacts.hasSecurityAudit,
    session.artifacts.hasUserGuide,
    session.artifacts.hasDeploymentGuide,
  ].filter(Boolean).length;

  // Can start build if scoping is done and not already running
  const canStartBuild = !session.isRunning && session.status !== 'completed' && session.currentPhase !== 'scoping';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href="/engineering"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to builds
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{session.projectName}</h1>
            <Badge variant="outline" className={getStatusBadgeClass(session.status)}>
              {getStatusIcon(session.status)}
              <span className="ml-1 capitalize">{session.status}</span>
            </Badge>
            {session.isRunning && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Building...
              </Badge>
            )}
          </div>
          {session.projectDescription && (
            <p className="text-neutral-400">{session.projectDescription}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canStartBuild && (
            <Button
              onClick={handleStartBuild}
              disabled={isStarting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Build
                </>
              )}
            </Button>
          )}
          {session.isRunning && (
            <Button
              onClick={handleStopBuild}
              disabled={isStopping}
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              )}
            </Button>
          )}
          {session.status === 'paused' && (
            <Button
              onClick={handleStartBuild}
              disabled={isStarting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resuming...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume Build
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Build Progress</CardTitle>
          <CardDescription>
            Current phase: {session.currentPhaseDisplay}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Overall Progress</span>
              <span className="text-white font-medium">{session.progress}%</span>
            </div>
            <Progress value={session.progress} className="h-3" />

            {/* Current Phase Info */}
            <div className="flex items-center gap-4 p-3 bg-neutral-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                {getAgentIcon(session.currentAgent)}
                <span className="text-sm text-neutral-400">Agent:</span>
                <span className="text-sm text-white capitalize">{session.currentAgent}</span>
              </div>
              {session.isRunning && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Running
                </Badge>
              )}
            </div>

            {/* Error Display */}
            {session.lastError && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Last Error</p>
                  <p className="text-sm text-red-300">{session.lastError}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase Progress */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">Phase Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {session.phaseProgress.map((phase, index) => (
              <div
                key={phase.phase}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  phase.isCurrent
                    ? 'bg-amber-500/10 border border-amber-500/20'
                    : phase.status === 'passed'
                    ? 'bg-emerald-500/5'
                    : 'bg-neutral-800/30'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6">
                  {getPhaseStatusIcon(phase.status, phase.isCurrent)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${phase.isCurrent ? 'text-amber-400' : 'text-white'}`}>
                      {phase.displayName}
                    </span>
                    <span className="text-xs text-neutral-500 capitalize">({phase.agent})</span>
                  </div>
                  {phase.isCurrent && (
                    <p className="text-xs text-neutral-400 mt-0.5">{phase.description}</p>
                  )}
                  {phase.failedReason && (
                    <p className="text-xs text-red-400 mt-0.5">{phase.failedReason}</p>
                  )}
                </div>
                {phase.passedAt && (
                  <span className="text-xs text-neutral-500">
                    {formatRelativeTime(new Date(phase.passedAt))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{artifactCount}</div>
              <div className="text-xs text-neutral-400">Artifacts</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{session.dependencyGraph.nodeCount}</div>
              <div className="text-xs text-neutral-400">Dependencies</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{session.totalApiCalls || 0}</div>
              <div className="text-xs text-neutral-400">API Calls</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {session.totalTokensUsed ? Math.round(session.totalTokensUsed / 1000) + 'K' : '0'}
              </div>
              <div className="text-xs text-neutral-400">Tokens Used</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Artifacts */}
      {artifactCount > 0 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Generated Artifacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {session.artifacts.hasPrd && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">PRD</span>
                </div>
              )}
              {session.artifacts.hasTechSpec && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <Code className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Tech Spec</span>
                </div>
              )}
              {session.artifacts.hasApiDocs && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">API Docs</span>
                </div>
              )}
              {session.artifacts.hasSecurityAudit && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Security Audit</span>
                </div>
              )}
              {session.artifacts.hasUserGuide && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">User Guide</span>
                </div>
              )}
              {session.artifacts.hasDeploymentGuide && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <Rocket className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Deployment Guide</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {allMessages.length > 0 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowMessages(!showMessages)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                Agent Messages ({allMessages.length})
                {liveMessages.length > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                    +{liveMessages.length} new
                  </Badge>
                )}
              </CardTitle>
              {showMessages ? (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              )}
            </div>
          </CardHeader>
          {showMessages && (
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allMessages.map((msg) => (
                  <div key={msg.id} className="p-3 bg-neutral-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-neutral-400 capitalize">
                        {msg.fromAgent}
                      </span>
                      <span className="text-xs text-neutral-600">→</span>
                      <span className="text-xs font-medium text-neutral-400 capitalize">
                        {msg.toAgent}
                      </span>
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        {msg.messageType}
                      </Badge>
                      {msg.createdAt && (
                        <span className="text-xs text-neutral-500 ml-auto">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-300">{msg.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Timestamps */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 text-sm text-neutral-400">
            <div>
              <span className="text-neutral-500">Started:</span>{' '}
              <span className="text-white">{formatRelativeTime(session.startedAt)}</span>
            </div>
            <div>
              <span className="text-neutral-500">Last Activity:</span>{' '}
              <span className="text-white">{formatRelativeTime(session.lastActivityAt)}</span>
            </div>
            {session.pausedAt && (
              <div>
                <span className="text-neutral-500">Paused:</span>{' '}
                <span className="text-amber-400">{formatRelativeTime(session.pausedAt)}</span>
              </div>
            )}
            {session.completedAt && (
              <div>
                <span className="text-neutral-500">Completed:</span>{' '}
                <span className="text-blue-400">{formatRelativeTime(session.completedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
