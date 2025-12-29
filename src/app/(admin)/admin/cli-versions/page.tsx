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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

const STATUS_CONFIG: Record<VersionStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  draft: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-600/20', label: 'Draft' },
  testing: { icon: Play, color: 'text-blue-400', bg: 'bg-blue-600/20', label: 'Testing' },
  stable: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-600/20', label: 'Stable' },
  deprecated: { icon: Archive, color: 'text-yellow-400', bg: 'bg-yellow-600/20', label: 'Deprecated' },
  blocked: { icon: Ban, color: 'text-red-400', bg: 'bg-red-600/20', label: 'Blocked' },
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

  const stableVersion = versions.find(v => v.status === 'stable' && v.isAutoUpdateEnabled);

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
            className="border-slate-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowNewDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Version
          </Button>
        </div>
      </div>

      {/* Current Auto-Update Target */}
      {stableVersion && (
        <Card className="bg-green-900/20 border-green-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-400 text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Auto-Update Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-mono text-lg">v{stableVersion.version}</p>
                <p className="text-slate-400 text-sm">
                  Users will be prompted to update to this version
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Rollout</p>
                <p className="text-white font-bold">{stableVersion.rolloutPercent}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version List */}
      <div className="space-y-4">
        {versions.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <Terminal className="h-12 w-12 mx-auto text-slate-500 mb-4" />
              <p className="text-slate-400">No CLI versions registered</p>
              <p className="text-slate-500 text-sm mt-1">
                Add a version after publishing to npm
              </p>
            </CardContent>
          </Card>
        ) : (
          versions.map((version) => {
            const config = STATUS_CONFIG[version.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedVersion === version.id;
            const nextStatus = getNextStatus(version.status);

            return (
              <Card key={version.id} className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CardTitle className="text-white font-mono text-xl">
                        v{version.version}
                      </CardTitle>
                      <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${config.bg} ${config.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                      {version.isAutoUpdateEnabled && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-600/20 text-green-400">
                          <RefreshCw className="h-3 w-3" />
                          Auto-Update ON
                        </span>
                      )}
                      {version.errorCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-600/20 text-red-400">
                          <Bug className="h-3 w-3" />
                          {version.errorCount} errors
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Quick actions */}
                      {version.status === 'stable' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateVersion(version.id, {
                            isAutoUpdateEnabled: !version.isAutoUpdateEnabled
                          })}
                          disabled={isUpdating === version.id}
                          className={`border-slate-700 ${version.isAutoUpdateEnabled ? 'text-red-400' : 'text-green-400'}`}
                        >
                          {isUpdating === version.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : version.isAutoUpdateEnabled ? (
                            <>
                              <Pause className="h-4 w-4 mr-1" />
                              Disable Auto-Update
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Enable Auto-Update
                            </>
                          )}
                        </Button>
                      )}
                      {nextStatus && (
                        <Button
                          size="sm"
                          onClick={() => updateVersion(version.id, { status: nextStatus })}
                          disabled={isUpdating === version.id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isUpdating === version.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>Promote to {nextStatus}</>
                          )}
                        </Button>
                      )}
                      {version.status !== 'blocked' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateVersion(version.id, { status: 'blocked' })}
                          disabled={isUpdating === version.id}
                          className="border-red-700 text-red-400 hover:bg-red-900/20"
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Block
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExpand(version.id)}
                        className="text-slate-400"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-slate-400">
                    Published {new Date(version.createdAt).toLocaleDateString()}
                    {version.publisher?.name && ` by ${version.publisher.name}`}
                    {version.npmTag && ` • npm tag: ${version.npmTag}`}
                  </CardDescription>
                </CardHeader>

                {/* Expanded detail */}
                {isExpanded && (
                  <CardContent className="border-t border-slate-700 pt-4">
                    {isLoadingDetail ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      </div>
                    ) : versionDetail ? (
                      <div className="space-y-6">
                        {/* Rollout Control */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-slate-900/50 rounded p-4">
                            <Label className="text-slate-400 text-sm flex items-center gap-2">
                              <Percent className="h-4 w-4" />
                              Rollout Percentage
                            </Label>
                            <div className="flex items-center gap-2 mt-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={versionDetail.rolloutPercent}
                                onChange={(e) => setVersionDetail({
                                  ...versionDetail,
                                  rolloutPercent: parseInt(e.target.value) || 0
                                })}
                                className="w-24 bg-slate-800 border-slate-700"
                              />
                              <span className="text-slate-400">%</span>
                              <Button
                                size="sm"
                                onClick={() => updateVersion(version.id, {
                                  rolloutPercent: versionDetail.rolloutPercent
                                })}
                                disabled={isUpdating === version.id}
                                className="ml-2"
                              >
                                Save
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Percentage of users who will receive this update
                            </p>
                          </div>

                          <div className="bg-slate-900/50 rounded p-4">
                            <Label className="text-slate-400 text-sm flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Requirements
                            </Label>
                            <p className="text-white mt-2">
                              Node.js {versionDetail.minNodeVersion}+
                            </p>
                          </div>
                        </div>

                        {/* Changelog */}
                        {(versionDetail.changelog || versionDetail.features) && (
                          <div className="bg-slate-900/50 rounded p-4">
                            <Label className="text-slate-400 text-sm">Changelog</Label>
                            {versionDetail.features && (
                              <p className="text-white mt-2 whitespace-pre-wrap">
                                {versionDetail.features}
                              </p>
                            )}
                            {versionDetail.changelog && (
                              <p className="text-slate-300 mt-2 whitespace-pre-wrap">
                                {versionDetail.changelog}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Breaking Changes */}
                        {versionDetail.breakingChanges && (
                          <div className="bg-red-900/20 rounded p-4 border border-red-700/30">
                            <Label className="text-red-400 text-sm flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Breaking Changes
                            </Label>
                            <p className="text-white mt-2 whitespace-pre-wrap">
                              {versionDetail.breakingChanges}
                            </p>
                          </div>
                        )}

                        {/* Error Reports */}
                        {versionDetail.errors && versionDetail.errors.total > 0 && (
                          <div className="bg-slate-900/50 rounded p-4">
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
                                    className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs"
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
                                    className="bg-slate-800/50 rounded p-2 text-sm"
                                  >
                                    <div className="flex justify-between">
                                      <span className="text-red-400 font-mono">
                                        {err.errorType}
                                      </span>
                                      <span className="text-slate-500 text-xs">
                                        {new Date(err.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                    {err.errorMessage && (
                                      <p className="text-slate-400 mt-1 truncate">
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
                        <div className="bg-slate-900/50 rounded p-4">
                          <Label className="text-slate-400 text-sm">Version Timeline</Label>
                          <div className="flex flex-wrap gap-4 mt-3 text-sm">
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
                      <p className="text-slate-400 text-center py-4">
                        Failed to load version details
                      </p>
                    )}
                  </CardContent>
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
                <Label className="text-slate-400">Version</Label>
                <Input
                  placeholder="1.2.0"
                  value={newVersion.version}
                  onChange={(e) => setNewVersion({ ...newVersion, version: e.target.value })}
                  className="bg-slate-900 border-slate-700 mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400">npm Tag</Label>
                <Select
                  value={newVersion.npmTag}
                  onValueChange={(value) => setNewVersion({ ...newVersion, npmTag: value })}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-700 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">latest</SelectItem>
                    <SelectItem value="beta">beta</SelectItem>
                    <SelectItem value="alpha">alpha</SelectItem>
                    <SelectItem value="canary">canary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-slate-400">Min Node Version</Label>
              <Input
                placeholder="18"
                value={newVersion.minNodeVersion}
                onChange={(e) => setNewVersion({ ...newVersion, minNodeVersion: e.target.value })}
                className="bg-slate-900 border-slate-700 mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400">Features / What's New</Label>
              <Textarea
                placeholder="- Added auto-update support&#10;- Improved error handling"
                value={newVersion.features}
                onChange={(e) => setNewVersion({ ...newVersion, features: e.target.value })}
                className="bg-slate-900 border-slate-700 mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-slate-400">Changelog</Label>
              <Textarea
                placeholder="Detailed changes..."
                value={newVersion.changelog}
                onChange={(e) => setNewVersion({ ...newVersion, changelog: e.target.value })}
                className="bg-slate-900 border-slate-700 mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-red-400">Breaking Changes (if any)</Label>
              <Textarea
                placeholder="Any breaking changes that users should know about..."
                value={newVersion.breakingChanges}
                onChange={(e) => setNewVersion({ ...newVersion, breakingChanges: e.target.value })}
                className="bg-slate-900 border-slate-700 mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewDialog(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={createVersion}
              disabled={!newVersion.version || isCreating}
              className="bg-green-600 hover:bg-green-700"
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
  );
}
