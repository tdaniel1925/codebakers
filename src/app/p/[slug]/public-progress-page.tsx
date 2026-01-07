'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, CheckCircle2, Circle, Loader2, Clock, FileCode, TestTube2, RefreshCw } from 'lucide-react';

interface Phase {
  id: string;
  name: string;
  status: string;
  progress: number;
  order: number;
}

interface ProjectData {
  projectName: string;
  description: string | null;
  teamName: string;
  status: {
    label: string;
    emoji: string;
    color: string;
  };
  progress: number | null;
  phases: Phase[] | null;
  stats: {
    filesCreated: number;
    testsRun: number;
    testsPassed: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  lastActivity: string | null;
}

interface PublicProgressPageProps {
  slug: string;
}

const statusColors: Record<string, string> = {
  purple: 'from-purple-500 to-purple-600',
  blue: 'from-blue-500 to-blue-600',
  yellow: 'from-amber-500 to-amber-600',
  orange: 'from-orange-500 to-orange-600',
  green: 'from-emerald-500 to-emerald-600',
  gray: 'from-gray-500 to-gray-600',
  red: 'from-red-500 to-red-600',
};

const phaseStatusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="h-5 w-5 text-gray-400" />,
  in_progress: <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />,
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  skipped: <Circle className="h-5 w-5 text-gray-300" />,
  failed: <Circle className="h-5 w-5 text-red-500" />,
};

export function PublicProgressPage({ slug }: PublicProgressPageProps) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/public/projects/${slug}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load project');
      }
      const projectData = await response.json();
      setData(projectData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds if project is in progress
    const interval = setInterval(() => {
      if (data?.status.color === 'yellow' || data?.status.color === 'orange') {
        fetchData();
        setLastRefresh(new Date());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Cookie className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Project Not Found</h1>
          <p className="text-slate-400 mb-6">
            {error || 'This project page is not available.'}
          </p>
          <Link
            href="https://codebakers.ai"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Visit CodeBakers
          </Link>
        </div>
      </div>
    );
  }

  const gradientClass = statusColors[data.status.color] || statusColors.yellow;
  const isActive = data.status.color === 'yellow' || data.status.color === 'orange';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="https://codebakers.ai" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Cookie className="h-5 w-5 text-slate-900" />
            </div>
            <span className="text-slate-400 group-hover:text-white transition-colors text-sm">
              Powered by CodeBakers
            </span>
          </Link>
          {isActive && (
            <button
              onClick={() => {
                fetchData();
                setLastRefresh(new Date());
              }}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Project Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full mb-6">
            <span className="text-lg">{data.status.emoji}</span>
            <span className={`font-medium bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
              {data.status.label}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {data.projectName}
          </h1>
          {data.description && (
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              {data.description}
            </p>
          )}
          <p className="text-slate-500 text-sm mt-4">
            Built by {data.teamName}
          </p>
        </div>

        {/* Progress Bar */}
        {data.progress !== null && (
          <div className="mb-12">
            <div className="flex justify-between items-center mb-3">
              <span className="text-slate-400 font-medium">Overall Progress</span>
              <span className="text-3xl font-bold text-white">{data.progress}%</span>
            </div>
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-700/50">
            <FileCode className="h-8 w-8 text-blue-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-white">{data.stats.filesCreated}</p>
            <p className="text-slate-400 text-sm">Files Created</p>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-700/50">
            <TestTube2 className="h-8 w-8 text-purple-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-white">{data.stats.testsRun}</p>
            <p className="text-slate-400 text-sm">Tests Run</p>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-700/50">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-white">{data.stats.testsPassed}</p>
            <p className="text-slate-400 text-sm">Tests Passed</p>
          </div>
        </div>

        {/* Phases / Todo List */}
        {data.phases && data.phases.length > 0 && (
          <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden mb-12">
            <div className="px-6 py-4 border-b border-slate-700/50">
              <h2 className="text-lg font-semibold text-white">Build Progress</h2>
              <p className="text-slate-400 text-sm">Track each phase of development</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {data.phases.map((phase) => (
                <div
                  key={phase.id}
                  className={`px-6 py-4 flex items-center gap-4 ${
                    phase.status === 'in_progress' ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    {phaseStatusIcons[phase.status] || phaseStatusIcons.pending}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${
                      phase.status === 'completed' ? 'text-slate-400' :
                      phase.status === 'in_progress' ? 'text-white' :
                      'text-slate-300'
                    }`}>
                      {phase.name}
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-32">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          phase.status === 'completed' ? 'bg-emerald-500' :
                          phase.status === 'in_progress' ? 'bg-amber-500' :
                          'bg-slate-600'
                        }`}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-12 text-right">
                    <span className={`text-sm ${
                      phase.status === 'completed' ? 'text-emerald-400' :
                      phase.status === 'in_progress' ? 'text-amber-400' :
                      'text-slate-500'
                    }`}>
                      {phase.progress}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Info */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          {data.startedAt && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Started {new Date(data.startedAt).toLocaleDateString()}</span>
            </div>
          )}
          {data.completedAt && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Completed {new Date(data.completedAt).toLocaleDateString()}</span>
            </div>
          )}
          {isActive && data.lastActivity && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span>Last activity {new Date(data.lastActivity).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <Link
            href="https://codebakers.ai"
            className="inline-flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <Cookie className="h-6 w-6 text-slate-900" />
            </div>
            <div className="text-left">
              <p className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                Built with CodeBakers
              </p>
              <p className="text-slate-500 text-sm">
                Production-ready code, first time
              </p>
            </div>
          </Link>
        </div>
      </footer>
    </div>
  );
}
