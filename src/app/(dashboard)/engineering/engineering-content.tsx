'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
  FileText,
  Loader2,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { EngineeringPhase } from '@/lib/engineering-types';

interface EngineeringSession {
  id: string;
  projectName: string;
  projectDescription: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  currentPhase: EngineeringPhase;
  currentPhaseDisplay: string;
  currentAgent: string;
  progress: number;
  startedAt: Date | null;
  lastActivityAt: Date | null;
  completedAt: Date | null;
  hasArtifacts: boolean;
}

interface EngineeringContentProps {
  sessions: EngineeringSession[];
  stats: {
    totalBuilds: number;
    activeBuilds: number;
    completedBuilds: number;
  } | null;
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

export function EngineeringContent({ sessions, stats }: EngineeringContentProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const otherSessions = sessions.filter((s) => s.status !== 'active');

  // Create new build and immediately start it
  const handleCreateBuild = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      // Step 1: Create the session
      const createRes = await fetch('/api/engineering/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: projectName.trim() }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const { data } = await createRes.json();
      const sessionId = data.sessionId;

      // Step 2: Auto-complete scoping (skip wizard for zero friction)
      // Mark scoping as done so build can start
      await fetch(`/api/engineering/sessions/${sessionId}/scope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: 'auto', answer: projectName.trim() }),
      });

      // Step 3: Start the build immediately
      await fetch(`/api/engineering/sessions/${sessionId}/build`, {
        method: 'POST',
      });

      // Navigate to the session
      router.push(`/engineering/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsCreating(false);
    }
  }, [projectName, router]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Wrench className="w-8 h-8 text-red-400" />
          Engineering Builds
        </h1>
        <p className="text-neutral-400">
          AI-powered project building - just describe what you want
        </p>
      </div>

      {/* New Build Form - ZERO FRICTION */}
      <Card className="bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border-emerald-500/30">
        <CardContent className="pt-6">
          <form onSubmit={handleCreateBuild} className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="What do you want to build? (e.g., 'A SaaS for invoicing', 'Todo app with auth')"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isCreating}
                className="flex-1 bg-neutral-900/50 border-neutral-700 text-white placeholder:text-neutral-500"
              />
              <Button
                type="submit"
                disabled={isCreating || !projectName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 px-6"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Build It
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <p className="text-xs text-neutral-500">
              Just describe your project in plain English. Our AI agents will automatically generate requirements,
              architecture, code, tests, and deployment configs.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{stats.totalBuilds}</div>
                <div className="text-sm text-neutral-400">Total Builds</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">{stats.activeBuilds}</div>
                <div className="text-sm text-neutral-400">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.completedBuilds}</div>
                <div className="text-sm text-neutral-400">Completed</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Sessions */}
      {sessions.length === 0 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-neutral-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No builds yet</h3>
              <p className="text-neutral-400 mb-6 max-w-md mx-auto">
                Start your first AI-assisted build using the CLI. The engineering system will guide you through
                requirements, architecture, implementation, and launch.
              </p>
              <code className="bg-neutral-800 px-4 py-2 rounded-lg text-sm text-neutral-300">
                codebakers build &quot;My Project&quot;
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-emerald-400" />
            Active Builds
          </h2>
          {activeSessions.map((session) => (
            <SessionCard key={session.id} session={session} isActive />
          ))}
        </div>
      )}

      {/* Other Sessions */}
      {otherSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recent Builds</h2>
          {otherSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, isActive = false }: { session: EngineeringSession; isActive?: boolean }) {
  return (
    <Link href={`/engineering/${session.id}`}>
      <Card className={`bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer ${isActive ? 'ring-1 ring-emerald-500/30' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white truncate">
                  {session.projectName}
                </h3>
                <Badge variant="outline" className={getStatusBadgeClass(session.status)}>
                  {getStatusIcon(session.status)}
                  <span className="ml-1 capitalize">{session.status}</span>
                </Badge>
              </div>
              {session.projectDescription && (
                <p className="text-sm text-neutral-400 truncate">{session.projectDescription}</p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              {session.hasArtifacts && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                  <FileText className="w-3 h-3 mr-1" />
                  Artifacts
                </Badge>
              )}
              <ArrowRight className="w-4 h-4 text-neutral-600" />
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Progress</span>
              <span className="text-white">{session.progress}%</span>
            </div>
            <Progress value={session.progress} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">
                Current: <span className="text-white">{session.currentPhaseDisplay}</span>
              </span>
              <span className="text-neutral-500">
                Agent: <span className="text-neutral-300 capitalize">{session.currentAgent}</span>
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-neutral-500 pt-4 border-t border-neutral-800">
            <div className="flex items-center gap-4">
              <span>
                Started: {session.startedAt ? formatRelativeTime(session.startedAt) : 'Unknown'}
              </span>
              <span>
                Last activity: {formatRelativeTime(session.lastActivityAt)}
              </span>
            </div>
            {session.status === 'completed' && session.completedAt && (
              <span className="text-blue-400">
                Completed: {formatRelativeTime(session.completedAt)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
