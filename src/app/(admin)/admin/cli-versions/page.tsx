'use client';

import { useState, useEffect } from 'react';
import {
  Terminal,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  Pause,
  Ban,
  Archive,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronUp,
  Bug,
  Users,
  Percent,
  Download,
  Package,
  Zap,
  Server,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type VersionStatus = 'draft' | 'testing' | 'stable' | 'deprecated' | 'blocked';

interface CliVersion {
  id: string;
  version: string;
  npmTag: string | null;
  status: VersionStatus;
  minNodeVersion: string | null;
  features: string | null;
  changelog: string | null;
  breakingChanges: string | null;
  rolloutPercent: number;
  isAutoUpdateEnabled: boolean;
  publishedBy: string | null;
  testedBy: string | null;
  approvedBy: string | null;
  errorCount: number;
  lastErrorAt: string | null;
  publishedAt: string | null;
  testedAt: string | null;
  stableAt: string | null;
  deprecatedAt: string | null;
  blockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publisher?: {
    name: string | null;
    email: string | null;
  };
}

interface ErrorReport {
  id: string;
  errorType: string;
  errorMessage: string | null;
  createdAt: string;
}

interface VersionDetail extends CliVersion {
  errors?: {
    recent: ErrorReport[];
    byType: { errorType: string; count: number }[];
    total: number;
  };
}

const STATUS_CONFIG: Record<VersionStatus, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  draft: { icon: Clock, color: 'text-slate-300', bg: 'bg-slate-700', border: 'border-slate-600', label: 'Draft' },
  testing: { icon: Play, color: 'text-blue-300', bg: 'bg-blue-900/50', border: 'border-blue-700', label: 'Testing' },
  stable: { icon: CheckCircle, color: 'text-green-300', bg: 'bg-green-900/50', border: 'border-green-700', label: 'Stable' },
  deprecated: { icon: Archive, color: 'text-yellow-300', bg: 'bg-yellow-900/50', border: 'border-yellow-700', label: 'Deprecated' },
  blocked: { icon: Ban, color: 'text-red-300', bg: 'bg-red-900/50', border: 'border-red-700', label: 'Blocked' },
};

export default function CliVersionsPage() {
  const [versions, setVersions] = useState<CliVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [versionDetail, setVersionDetail] = useState<VersionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // New version dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newVersion, setNewVersion] = useState({
    version: '',
    npmTag: 'latest',
    minNodeVersion: '18',
    features: '',
    changelog: '',
    breakingChanges: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Status update
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Import from npm
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; total: number; latest?: string } | null>(null);

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      const res = await fetch('/api/admin/cli-versions');
      if (!res.ok) throw new Error('Failed to fetch versions');
      const data = await res.json();
      setVersions(data.data.versions || []);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVersionDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/cli-versions/${id}`);
      if (!res.ok) throw new Error('Failed to fetch version detail');
      const data = await res.json();
      setVersionDetail(data.data.version ? { ...data.data.version, errors: data.data.errors } : null);
    } catch (error) {
      console.error('Failed to load version detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedVersion === id) {
      setExpandedVersion(null);
      setVersionDetail(null);
    } else {
      setExpandedVersion(id);
      await fetchVersionDetail(id);
    }
  };

  const createVersion = async () => {
    if (!newVersion.version) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/cli-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVersion),
      });
      if (!res.ok) throw new Error('Failed to create version');
      await fetchVersions();
      setShowNewDialog(false);
      setNewVersion({
        version: '',
        npmTag: 'latest',
        minNodeVersion: '18',
        features: '',
        changelog: '',
        breakingChanges: '',
      });
    } catch (error) {
      console.error('Failed to create version:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const importFromNpm = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/admin/cli-versions/import-npm', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to import from npm');
      const data = await res.json();
      setImportResult({
        imported: data.data.imported,
        total: data.data.total,
        latest: data.data.latest,
      });
      await fetchVersions();
    } catch (error) {
      console.error('Failed to import from npm:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const updateVersion = async (id: string, updates: Partial<CliVersion>) => {
    setIsUpdating(id);
    try {
      const res = await fetch(`/api/admin/cli-versions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update version');
      await fetchVersions();
      if (expandedVersion === id) {
        await fetchVersionDetail(id);
      }
    } catch (error) {
      console.error('Failed to update version:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const getNextStatus = (current: VersionStatus): VersionStatus | null => {
    const flow: Record<VersionStatus, VersionStatus | null> = {
      draft: 'testing',
      testing: 'stable',
      stable: 'deprecated',
      deprecated: null,
      blocked: null,
    };
    return flow[current];
  };

  // Stats calculations
  const stableVersion = versions.find(v => v.status === 'stable' && v.isAutoUpdateEnabled);
  const totalVersions = versions.length;
  const stableVersions = versions.filter(v => v.status === 'stable').length;
  const totalErrors = versions.reduce((sum, v) => sum + v.errorCount, 0);
  const latestVersion = versions[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Terminal className="h-8 w-8 text-green-400" />
              CLI Version Control
            </h1>
            <p className="text-slate-400 mt-1">
              Manage CLI releases, auto-updates, and error tracking
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVersions}
              className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={importFromNpm}
              disabled={isImporting}
              className="border-blue-600 bg-blue-900/30 text-blue-300 hover:bg-blue-800/50 hover:text-blue-200"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Import from npm
            </Button>
            <Button
              onClick={() => setShowNewDialog(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Version
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Versions</p>
                  <p className="text-2xl font-bold text-white">{totalVersions}</p>
                </div>
                <Package className="h-8 w-8 text-slate-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Stable Releases</p>
                  <p className="text-2xl font-bold text-green-400">{stableVersions}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Latest Version</p>
                  <p className="text-2xl font-bold text-blue-400 font-mono">
                    {latestVersion ? `v${latestVersion.version}` : '-'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Errors</p>
                  <p className={`text-2xl font-bold ${totalErrors > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {totalErrors}
                  </p>
                </div>
                <Bug className="h-8 w-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Import Result Message */}
        {importResult && (
          <Card className="bg-blue-900/30 border-blue-700/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-400" />
                <div className="flex-1">
                  <p className="text-white font-medium">
                    Imported {importResult.imported} new version{importResult.imported !== 1 ? 's' : ''} from npm
                  </p>
                  <p className="text-slate-400 text-sm">
                    Total versions on npm: {importResult.total}
                    {importResult.latest && ` • Latest: v${importResult.latest}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportResult(null)}
                  className="text-slate-400 hover:text-white hover:bg-slate-700"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Auto-Update Target */}
        {stableVersion && (
          <Card className="bg-gradient-to-r from-green-900/30 to-green-800/10 border-green-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Update Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-white font-mono text-2xl font-bold">v{stableVersion.version}</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Users will be prompted to update to this version
                    </p>
                  </div>
                  {stableVersion.minNodeVersion && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
                      <Server className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-300 text-sm">Node.js {stableVersion.minNodeVersion}+</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-slate-400 text-sm">Rollout</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-slate-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Percentage of users receiving update prompts</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-3xl font-bold text-green-400">{stableVersion.rolloutPercent}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Version List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">All Versions</h2>
          {versions.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Terminal className="h-12 w-12 mx-auto text-slate-500 mb-4" />
                <p className="text-white font-medium">No CLI versions registered</p>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  Import all versions from npm registry to get started
                </p>
                <Button
                  onClick={importFromNpm}
                  disabled={isImporting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Import from npm
                </Button>
              </CardContent>
            </Card>
          ) : (
            versions.map((version) => {
              const config = STATUS_CONFIG[version.status];
              const StatusIcon = config.icon;
              const isExpanded = expandedVersion === version.id;
              const nextStatus = getNextStatus(version.status);

              return (
                <Card
                  key={version.id}
                  className={`border transition-colors ${
                    version.isAutoUpdateEnabled && version.status === 'stable'
                      ? 'bg-green-900/10 border-green-700/50 hover:border-green-600/50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <CardContent className="py-4">
                    {/* Top Row: Version + Badges + Info */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Version Number */}
                      <p className="text-white font-mono text-xl font-bold">v{version.version}</p>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Badge */}
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} border ${config.border}`}>
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </span>

                        {/* Auto-Update Badge */}
                        {version.isAutoUpdateEnabled && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
                            <Zap className="h-3 w-3" />
                            Auto-Update ON
                          </span>
                        )}

                        {/* Error Badge */}
                        {version.errorCount > 0 && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-700">
                            <Bug className="h-3 w-3" />
                            {version.errorCount} error{version.errorCount !== 1 ? 's' : ''}
                          </span>
                        )}

                        {/* Breaking Changes Warning */}
                        {version.breakingChanges && (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-700">
                                <AlertTriangle className="h-3 w-3" />
                                Breaking
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This version has breaking changes</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {/* Info Section */}
                      <div className="flex flex-wrap items-center gap-4 text-sm ml-auto">
                        {/* Rollout */}
                        {version.status === 'stable' && (
                          <div className="flex items-center gap-1.5">
                            <Percent className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-slate-300">
                              <span className="font-medium text-white">{version.rolloutPercent}%</span>
                            </span>
                          </div>
                        )}

                        {/* Node Version */}
                        {version.minNodeVersion && (
                          <div className="flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-slate-400 text-xs">Node {version.minNodeVersion}+</span>
                          </div>
                        )}

                        {/* npm Tag */}
                        {version.npmTag && (
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-slate-400 font-mono text-xs">{version.npmTag}</span>
                          </div>
                        )}

                        {/* Published Date */}
                        <span className="text-slate-500 text-xs">
                          {new Date(version.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                        {/* Auto-Update Toggle for Stable */}
                        {version.status === 'stable' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateVersion(version.id, {
                              isAutoUpdateEnabled: !version.isAutoUpdateEnabled
                            })}
                            disabled={isUpdating === version.id}
                            className={`border ${
                              version.isAutoUpdateEnabled
                                ? 'border-red-600 bg-red-900/20 text-red-300 hover:bg-red-900/40 hover:text-red-200'
                                : 'border-green-600 bg-green-900/20 text-green-300 hover:bg-green-900/40 hover:text-green-200'
                            }`}
                          >
                            {isUpdating === version.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : version.isAutoUpdateEnabled ? (
                              <>
                                <Pause className="h-4 w-4 mr-1.5" />
                                Disable Auto-Update
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1.5" />
                                Enable Auto-Update
                              </>
                            )}
                          </Button>
                        )}

                        {/* Promote to Stable for Draft/Testing */}
                        {(version.status === 'draft' || version.status === 'testing') && (
                          <Button
                            size="sm"
                            onClick={() => updateVersion(version.id, { status: 'stable' })}
                            disabled={isUpdating === version.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isUpdating === version.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1.5" />
                                Promote to stable
                              </>
                            )}
                          </Button>
                        )}

                        {/* Deprecate for Stable */}
                        {nextStatus && nextStatus !== 'stable' && (
                          <Button
                            size="sm"
                            onClick={() => updateVersion(version.id, { status: nextStatus })}
                            disabled={isUpdating === version.id}
                            className={`text-white ${
                              nextStatus === 'deprecated'
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isUpdating === version.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>Promote to {nextStatus}</>
                            )}
                          </Button>
                        )}

                        {/* Block Button */}
                        {version.status !== 'blocked' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateVersion(version.id, { status: 'blocked' })}
                            disabled={isUpdating === version.id}
                            className="border-red-600 bg-red-900/20 text-red-300 hover:bg-red-900/40 hover:text-red-200"
                          >
                            <Ban className="h-4 w-4 mr-1.5" />
                            Block
                          </Button>
                        )}

                      {/* Expand Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExpand(version.id)}
                        className="text-slate-400 hover:text-white hover:bg-slate-700 ml-auto"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Features Preview (if available and not expanded) */}
                    {!isExpanded && version.features && (
                      <p className="text-slate-400 text-sm line-clamp-1 mt-3">
                        <span className="text-slate-500 mr-2">Features:</span>
                        {version.features.split('\n')[0].replace(/^[-•*]\s*/, '')}
                      </p>
                    )}
                  </CardContent>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-700 bg-slate-900/50">
                      <CardContent className="pt-4">
                        {isLoadingDetail ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                          </div>
                        ) : versionDetail ? (
                          <div className="space-y-6">
                            {/* Rollout Control */}
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <Label className="text-slate-300 text-sm flex items-center gap-2">
                                  <Percent className="h-4 w-4 text-slate-500" />
                                  Rollout Percentage
                                </Label>
                                <div className="flex items-center gap-2 mt-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={versionDetail.rolloutPercent}
                                    onChange={(e) => setVersionDetail({
                                      ...versionDetail,
                                      rolloutPercent: parseInt(e.target.value) || 0
                                    })}
                                    className="w-24 bg-slate-900 border-slate-600 text-white"
                                  />
                                  <span className="text-slate-400">%</span>
                                  <Button
                                    size="sm"
                                    onClick={() => updateVersion(version.id, {
                                      rolloutPercent: versionDetail.rolloutPercent
                                    })}
                                    disabled={isUpdating === version.id}
                                    className="ml-2 bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    Save
                                  </Button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                  Percentage of users who will receive this update
                                </p>
                              </div>

                              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <Label className="text-slate-300 text-sm flex items-center gap-2">
                                  <Server className="h-4 w-4 text-slate-500" />
                                  Requirements
                                </Label>
                                <p className="text-white mt-3 text-lg font-medium">
                                  Node.js {versionDetail.minNodeVersion || '18'}+
                                </p>
                                <p className="text-xs text-slate-500 mt-2">
                                  Minimum Node.js version required
                                </p>
                              </div>
                            </div>

                            {/* Changelog */}
                            {(versionDetail.changelog || versionDetail.features) && (
                              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <Label className="text-slate-300 text-sm">Changelog & Features</Label>
                                {versionDetail.features && (
                                  <div className="mt-3">
                                    <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                                      {versionDetail.features}
                                    </p>
                                  </div>
                                )}
                                {versionDetail.changelog && (
                                  <p className="text-slate-400 mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                                    {versionDetail.changelog}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Breaking Changes */}
                            {versionDetail.breakingChanges && (
                              <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-700/50">
                                <Label className="text-orange-300 text-sm flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  Breaking Changes
                                </Label>
                                <p className="text-white mt-3 whitespace-pre-wrap text-sm">
                                  {versionDetail.breakingChanges}
                                </p>
                              </div>
                            )}

                            {/* Error Reports */}
                            {versionDetail.errors && versionDetail.errors.total > 0 && (
                              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <Label className="text-red-400 text-sm flex items-center gap-2">
                                  <Bug className="h-4 w-4" />
                                  Error Reports ({versionDetail.errors.total})
                                </Label>

                                {/* Error by type */}
                                {versionDetail.errors.byType.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {versionDetail.errors.byType.map((err) => (
                                      <span
                                        key={err.errorType}
                                        className="px-3 py-1.5 bg-red-900/30 text-red-300 rounded-full text-xs border border-red-700/50"
                                      >
                                        {err.errorType}: {err.count}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Recent errors */}
                                {versionDetail.errors.recent.length > 0 && (
                                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                                    {versionDetail.errors.recent.map((err) => (
                                      <div
                                        key={err.id}
                                        className="bg-slate-900/50 rounded p-3 text-sm border border-slate-700"
                                      >
                                        <div className="flex justify-between">
                                          <span className="text-red-400 font-mono text-xs">
                                            {err.errorType}
                                          </span>
                                          <span className="text-slate-500 text-xs">
                                            {new Date(err.createdAt).toLocaleString()}
                                          </span>
                                        </div>
                                        {err.errorMessage && (
                                          <p className="text-slate-400 mt-1 text-xs truncate">
                                            {err.errorMessage}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Timeline */}
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                              <Label className="text-slate-300 text-sm">Version Timeline</Label>
                              <div className="flex flex-wrap gap-6 mt-3 text-sm">
                                <div>
                                  <span className="text-slate-500">Created:</span>{' '}
                                  <span className="text-white">
                                    {new Date(versionDetail.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                {versionDetail.testedAt && (
                                  <div>
                                    <span className="text-slate-500">Tested:</span>{' '}
                                    <span className="text-blue-400">
                                      {new Date(versionDetail.testedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                {versionDetail.stableAt && (
                                  <div>
                                    <span className="text-slate-500">Stable:</span>{' '}
                                    <span className="text-green-400">
                                      {new Date(versionDetail.stableAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                {versionDetail.deprecatedAt && (
                                  <div>
                                    <span className="text-slate-500">Deprecated:</span>{' '}
                                    <span className="text-yellow-400">
                                      {new Date(versionDetail.deprecatedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                {versionDetail.blockedAt && (
                                  <div>
                                    <span className="text-slate-500">Blocked:</span>{' '}
                                    <span className="text-red-400">
                                      {new Date(versionDetail.blockedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-4">
                            Failed to load version details
                          </p>
                        )}
                      </CardContent>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* New Version Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Add CLI Version</DialogTitle>
              <DialogDescription className="text-slate-400">
                Register a new CLI version after publishing to npm
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Version</Label>
                  <Input
                    placeholder="1.2.0"
                    value={newVersion.version}
                    onChange={(e) => setNewVersion({ ...newVersion, version: e.target.value })}
                    className="bg-slate-900 border-slate-600 text-white mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">npm Tag</Label>
                  <Select
                    value={newVersion.npmTag}
                    onValueChange={(value) => setNewVersion({ ...newVersion, npmTag: value })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="latest">latest</SelectItem>
                      <SelectItem value="beta">beta</SelectItem>
                      <SelectItem value="alpha">alpha</SelectItem>
                      <SelectItem value="canary">canary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Min Node Version</Label>
                <Input
                  placeholder="18"
                  value={newVersion.minNodeVersion}
                  onChange={(e) => setNewVersion({ ...newVersion, minNodeVersion: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white mt-1.5"
                />
              </div>
              <div>
                <Label className="text-slate-300">Features / What's New</Label>
                <Textarea
                  placeholder="- Added auto-update support&#10;- Improved error handling"
                  value={newVersion.features}
                  onChange={(e) => setNewVersion({ ...newVersion, features: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white mt-1.5"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-slate-300">Changelog</Label>
                <Textarea
                  placeholder="Detailed changes..."
                  value={newVersion.changelog}
                  onChange={(e) => setNewVersion({ ...newVersion, changelog: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white mt-1.5"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-orange-400">Breaking Changes (if any)</Label>
                <Textarea
                  placeholder="Any breaking changes that users should know about..."
                  value={newVersion.breakingChanges}
                  onChange={(e) => setNewVersion({ ...newVersion, breakingChanges: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white mt-1.5"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowNewDialog(false)}
                className="border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={createVersion}
                disabled={!newVersion.version || isCreating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Version
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
