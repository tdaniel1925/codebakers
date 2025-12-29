'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileWarning,
  CheckCircle,
  Clock,
  Sparkles,
  Eye,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Report {
  id: string;
  moduleName: string;
  issue: string;
  modulePattern: string | null;
  currentPattern: string | null;
  sourceUrl: string | null;
  status: string;
  fixedInVersion: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  fixedAt: string | null;
}

interface ModuleGroup {
  moduleName: string;
  pendingCount: number;
  totalCount: number;
  reports: Report[];
}

interface GeneratedChanges {
  claudeMd?: string;
  cursorRules?: string;
  modules?: Record<string, string>;
  summary: string;
}

interface AIFixResult {
  message: string;
  changes: GeneratedChanges | null;
  report: {
    id: string;
    moduleName: string;
    issue: string;
  };
}

export default function AdminReportsPage() {
  const [modules, setModules] = useState<ModuleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [fixVersion, setFixVersion] = useState<Record<string, string>>({});

  // AI Fix states
  const [isGeneratingFix, setIsGeneratingFix] = useState<string | null>(null);
  const [showFixPreview, setShowFixPreview] = useState(false);
  const [aiFixResult, setAiFixResult] = useState<AIFixResult | null>(null);
  const [expandedFixModules, setExpandedFixModules] = useState<Set<string>>(new Set());
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports/outdated');
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setModules(data.data.modules);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  };

  const updateStatus = async (reportId: string, status: string, fixedInVersion?: string) => {
    setIsUpdating(reportId);
    try {
      const response = await fetch(`/api/reports/outdated/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, fixedInVersion }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`Report marked as ${status}`);
      await fetchReports();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'acknowledged':
        return <Badge className="bg-blue-600"><AlertTriangle className="h-3 w-3 mr-1" />Acknowledged</Badge>;
      case 'fixed':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Fixed</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="border-slate-600 text-slate-400"><X className="h-3 w-3 mr-1" />Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const generateAiFix = async (reportId: string) => {
    setIsGeneratingFix(reportId);
    try {
      const response = await fetch('/api/admin/reports/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });

      if (!response.ok) throw new Error('Failed to generate fix');

      const data = await response.json();

      if (data.data.changes) {
        setAiFixResult(data.data);
        setShowFixPreview(true);
        toast.success('AI fix generated! Review and apply.');
      } else {
        toast.info('AI analyzed the report but could not generate specific changes. ' + data.data.message);
      }
    } catch (error) {
      toast.error('Failed to generate AI fix');
    } finally {
      setIsGeneratingFix(null);
    }
  };

  const toggleFixModuleExpand = (name: string) => {
    const newExpanded = new Set(expandedFixModules);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedFixModules(newExpanded);
  };

  const applyAiFix = async () => {
    if (!aiFixResult?.changes) return;

    setIsApplyingFix(true);
    try {
      const response = await fetch('/api/admin/module-builder/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: aiFixResult.changes,
        }),
      });

      if (!response.ok) throw new Error('Failed to apply fix');

      const data = await response.json();

      // Mark the report as fixed
      await updateStatus(aiFixResult.report.id, 'fixed', data.data.version.version);

      toast.success('Fix applied! New version created and report marked as fixed.');
      setShowFixPreview(false);
      setAiFixResult(null);
      await fetchReports();
    } catch (error) {
      toast.error('Failed to apply fix');
    } finally {
      setIsApplyingFix(false);
    }
  };

  const totalPending = modules.reduce((acc, m) => acc + m.pendingCount, 0);
  const totalReports = modules.reduce((acc, m) => acc + m.totalCount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Module Reports</h1>
        <p className="text-slate-400 mt-1">
          Track outdated module reports from users
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Total Reports
            </CardTitle>
            <FileWarning className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalReports}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{totalPending}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Modules Affected
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {modules.filter((m) => m.pendingCount > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : modules.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">All Clear!</h3>
            <p className="text-slate-400">No module reports yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map((module) => (
            <Card key={module.moduleName} className="bg-slate-800/50 border-slate-700">
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleModule(module.moduleName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle className="font-mono text-white">
                      {module.moduleName}
                    </CardTitle>
                    <div className="flex gap-2">
                      {module.pendingCount > 0 && (
                        <Badge className="bg-yellow-600">
                          {module.pendingCount} pending
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-slate-600 text-slate-400">
                        {module.totalCount} total
                      </Badge>
                    </div>
                  </div>
                  {expandedModules.has(module.moduleName) ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                {module.reports[0] && (
                  <CardDescription className="text-slate-400 mt-2">
                    Latest: {module.reports[0].issue}
                  </CardDescription>
                )}
              </CardHeader>

              {expandedModules.has(module.moduleName) && (
                <CardContent className="space-y-4 border-t border-slate-700 pt-4">
                  {module.reports.map((report) => (
                    <div
                      key={report.id}
                      className={`border rounded-lg p-4 space-y-3 ${
                        report.status === 'pending'
                          ? 'border-yellow-600/50 bg-yellow-900/10'
                          : 'border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-white">{report.issue}</p>
                          {report.sourceUrl && (
                            <a
                              href={report.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:underline flex items-center gap-1 mt-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {report.sourceUrl}
                            </a>
                          )}
                        </div>
                        {getStatusBadge(report.status)}
                      </div>

                      {report.modulePattern && (
                        <div className="text-sm">
                          <span className="text-slate-400">Module shows: </span>
                          <code className="bg-slate-900 px-2 py-0.5 rounded text-red-400">
                            {report.modulePattern}
                          </code>
                        </div>
                      )}

                      {report.currentPattern && (
                        <div className="text-sm">
                          <span className="text-slate-400">Should be: </span>
                          <code className="bg-slate-900 px-2 py-0.5 rounded text-green-400">
                            {report.currentPattern}
                          </code>
                        </div>
                      )}

                      <div className="text-xs text-slate-400">
                        Reported: {new Date(report.createdAt).toLocaleDateString()}
                        {report.fixedInVersion && (
                          <span className="ml-4">Fixed in: v{report.fixedInVersion}</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-700 flex-wrap">
                        {/* AI Fix Button - shown for pending/acknowledged reports */}
                        {(report.status === 'pending' || report.status === 'acknowledged') && (
                          <Button
                            size="sm"
                            onClick={() => generateAiFix(report.id)}
                            disabled={isGeneratingFix === report.id}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            {isGeneratingFix === report.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            Fix with AI
                          </Button>
                        )}

                        {report.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(report.id, 'acknowledged')}
                            disabled={isUpdating === report.id}
                            className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
                          >
                            {isUpdating === report.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 mr-1" />
                            )}
                            Acknowledge
                          </Button>
                        )}

                        {report.status !== 'fixed' && (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Version"
                              value={fixVersion[report.id] || ''}
                              onChange={(e) =>
                                setFixVersion((prev) => ({
                                  ...prev,
                                  [report.id]: e.target.value,
                                }))
                              }
                              className="w-24 h-8 bg-slate-700 border-slate-600 text-white text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatus(report.id, 'fixed', fixVersion[report.id])
                              }
                              disabled={isUpdating === report.id}
                              className="border-green-600 text-green-400 hover:bg-green-900/20"
                            >
                              {isUpdating === report.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 mr-1" />
                              )}
                              Mark Fixed
                            </Button>
                          </div>
                        )}

                        {report.status !== 'dismissed' && report.status !== 'fixed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(report.id, 'dismissed')}
                            disabled={isUpdating === report.id}
                            className="text-slate-400 hover:text-slate-200"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* AI Fix Preview Dialog */}
      <Dialog open={showFixPreview} onOpenChange={setShowFixPreview}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              AI-Generated Fix
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Review the AI-generated fix before applying
            </DialogDescription>
          </DialogHeader>

          {aiFixResult && (
            <div className="space-y-4 py-4">
              {/* Report Info */}
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-slate-400">Fixing report for:</p>
                <p className="text-white font-medium">{aiFixResult.report.moduleName}</p>
                <p className="text-sm text-slate-300 mt-1">{aiFixResult.report.issue}</p>
              </div>

              {/* AI Analysis */}
              {aiFixResult.message && (
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                  <p className="text-sm text-purple-200 whitespace-pre-wrap">{aiFixResult.message}</p>
                </div>
              )}

              {aiFixResult.changes && (
                <>
                  {/* Summary */}
                  <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                    <p className="text-green-200 text-sm font-medium">Changes Summary:</p>
                    <p className="text-green-100 text-sm mt-1">{aiFixResult.changes.summary}</p>
                  </div>

                  {/* CLAUDE.md changes */}
                  {aiFixResult.changes.claudeMd && (
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <button
                        onClick={() => toggleFixModuleExpand('claudeMd')}
                        className="flex items-center justify-between w-full"
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-green-400" />
                          <span className="text-white font-medium">CLAUDE.md</span>
                          <Badge className="bg-green-600">Updated</Badge>
                        </div>
                        {expandedFixModules.has('claudeMd') ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {expandedFixModules.has('claudeMd') && (
                        <pre className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60">
                          {aiFixResult.changes.claudeMd}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* .cursorrules changes */}
                  {aiFixResult.changes.cursorRules && (
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <button
                        onClick={() => toggleFixModuleExpand('cursorRules')}
                        className="flex items-center justify-between w-full"
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-green-400" />
                          <span className="text-white font-medium">.cursorrules</span>
                          <Badge className="bg-green-600">Updated</Badge>
                        </div>
                        {expandedFixModules.has('cursorRules') ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {expandedFixModules.has('cursorRules') && (
                        <pre className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60">
                          {aiFixResult.changes.cursorRules}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Module files */}
                  {aiFixResult.changes.modules && Object.entries(aiFixResult.changes.modules).map(([name, content]) => (
                    <div key={name} className="bg-slate-900/50 rounded-lg p-4">
                      <button
                        onClick={() => toggleFixModuleExpand(name)}
                        className="flex items-center justify-between w-full"
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-blue-400" />
                          <span className="text-white font-medium">{name}</span>
                          <Badge className="bg-blue-600">Module</Badge>
                        </div>
                        {expandedFixModules.has(name) ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {expandedFixModules.has(name) && (
                        <pre className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60">
                          {content}
                        </pre>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowFixPreview(false);
                setAiFixResult(null);
              }}
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={applyAiFix}
              disabled={isApplyingFix || !aiFixResult?.changes}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isApplyingFix ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Apply Fix & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
