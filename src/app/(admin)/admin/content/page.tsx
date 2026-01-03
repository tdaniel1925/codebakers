'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Upload,
  FileText,
  Check,
  Clock,
  Trash2,
  Eye,
  Rocket,
  Plus,
  ChevronDown,
  ChevronUp,
  File,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ContentVersion {
  id: string;
  version: string;
  changelog: string | null;
  isActive: boolean;
  createdAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
  publisherEmail: string | null;
  publisherName: string | null;
  // Stats from API
  hasClaudeMd: boolean;
  hasCursorRules: boolean;
  claudeMdLines: number;
  cursorRulesLines: number;
  moduleCount: number;
  cursorModuleCount: number;
  totalLines: number;
}

// Helper to count lines
const countLines = (content: string) => content.split('\n').length;

// Helper to format file size
const formatSize = (content: string) => {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper to extract module description from content
const getModuleDescription = (name: string, content: string): string => {
  const descriptions: Record<string, string> = {
    '00-core.md': 'Standards, types, error handling',
    '01-database.md': 'Drizzle ORM, queries, migrations',
    '02-auth.md': 'Authentication, 2FA, OAuth',
    '03-api.md': 'API routes, validation, rate limits',
    '04-frontend.md': 'React, forms, state management',
    '05-payments.md': 'Stripe, subscriptions, billing',
    '06-integrations.md': 'Email, files, background jobs',
    '07-performance.md': 'Caching, optimization',
    '08-testing.md': 'Tests, CI/CD, monitoring',
    '09-design.md': 'UI patterns, accessibility',
    '10-generators.md': 'Code scaffolding, templates',
    '11-realtime.md': 'WebSockets, live updates',
    '12-saas.md': 'Multi-tenant, feature flags',
    '13-mobile.md': 'React Native, Expo',
    '14-ai.md': 'OpenAI, Anthropic, RAG',
    '15-research.md': 'Market research, analysis',
    '16-planning.md': 'PRD, roadmap, specs',
    '17-marketing.md': 'Growth, campaigns',
    '18-launch.md': 'Launch playbook',
    '19-audit.md': 'Code audits, upgrades',
    '20-operations.md': 'Monitoring, incidents',
    '21-experts-core.md': 'Backend/frontend experts',
    '22-experts-health.md': 'Healthcare, HIPAA',
    '23-experts-finance.md': 'Fintech, PCI',
    '24-experts-legal.md': 'Legal tech, privacy',
    '25-experts-industry.md': 'Industry verticals',
    '26-analytics.md': 'PostHog, Mixpanel',
    '27-search.md': 'Full-text, Algolia',
    '28-email-design.md': 'HTML emails, MJML',
    '29-data-viz.md': 'Charts, dashboards',
    '30-motion.md': 'Animations, transitions',
    '31-iconography.md': 'Icons, SVG',
    '32-print.md': 'PDF generation',
    '33-cicd.md': 'CI/CD, GitHub Actions',
    '34-integration-contracts.md': 'Cross-system patterns',
    '35-environment.md': 'Env vars, secrets',
    '36-pre-launch.md': 'Pre-launch checklist',
    '37-quality-gates.md': 'Code quality, linting',
    '38-troubleshooting.md': 'Debugging, fixes',
    '39-self-healing.md': 'Auto-fix with AI',
  };
  return descriptions[name] || `${countLines(content)} lines`;
};

interface VersionDetail {
  id: string;
  version: string;
  routerContent: string | null;
  cursorRulesContent: string | null;
  claudeMdContent: string | null;
  modulesContent: Record<string, string>;
  cursorModulesContent: Record<string, string>;
  changelog: string | null;
  isActive: boolean;
}

export default function AdminContentPage() {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(null);
  const [expandedModules, setExpandedModules] = useState(false);

  // Form state
  const [newVersion, setNewVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [cursorRulesContent, setCursorRulesContent] = useState('');
  const [claudeMdContent, setClaudeMdContent] = useState('');
  const [modulesContent, setModulesContent] = useState<Record<string, string>>({});
  const [cursorModulesContent, setCursorModulesContent] = useState<Record<string, string>>({});
  const [expandedCursorModules, setExpandedCursorModules] = useState(false);

  // File input refs
  const cursorInputRef = useRef<HTMLInputElement>(null);
  const claudeInputRef = useRef<HTMLInputElement>(null);
  const modulesInputRef = useRef<HTMLInputElement>(null);
  const cursorModulesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      const response = await fetch('/api/admin/content');
      if (!response.ok) throw new Error('Failed to fetch versions');
      const data = await response.json();
      setVersions(data.data.versions);
    } catch (error) {
      toast.error('Failed to load content versions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncFromServer = async () => {
    if (!confirm('This will read CLAUDE.md and .claude/ folder from the DEPLOYED server (Vercel) and create a new version.\n\nNote: The .claude/ folder must be committed to git and deployed for this to work.\n\nContinue?')) {
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/admin/sync-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync content');
      }

      toast.success(`Synced! Created version ${data.version} with ${data.modules?.length || 0} modules`, {
        description: 'Content is now live for all users',
        duration: 5000,
      });

      fetchVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync content');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'cursor' | 'claude' | 'modules' | 'cursorModules'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (type === 'modules') {
      // Handle .claude folder - get all .md files
      const newModules: Record<string, string> = { ...modulesContent };
      let loadedCount = 0;
      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.md')) continue;
        const content = await file.text();
        const fileName = file.name.split('/').pop() || file.name;
        newModules[fileName] = content;
        loadedCount++;
      }
      setModulesContent(newModules);
      if (loadedCount > 0) {
        toast.success(`Loaded ${loadedCount} module file(s)`);
      } else {
        toast.error('No .md files found');
      }
      e.target.value = '';
    } else if (type === 'cursorModules') {
      // Handle .cursorrules-modules folder - get all .md files
      const newModules: Record<string, string> = { ...cursorModulesContent };
      let loadedCount = 0;
      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.md')) continue;
        const content = await file.text();
        const fileName = file.name.split('/').pop() || file.name;
        newModules[fileName] = content;
        loadedCount++;
      }
      setCursorModulesContent(newModules);
      if (loadedCount > 0) {
        toast.success(`Loaded ${loadedCount} cursor module file(s)`);
      } else {
        toast.error('No .md files found');
      }
      e.target.value = '';
    } else {
      const content = await files[0].text();
      if (type === 'cursor') {
        setCursorRulesContent(content);
        toast.success('.cursorrules loaded');
      } else {
        setClaudeMdContent(content);
        toast.success('CLAUDE.md loaded');
      }
    }
  };

  const handleCreate = async () => {
    if (!newVersion.trim()) {
      toast.error('Version is required');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: newVersion,
          changelog,
          cursorRulesContent: cursorRulesContent || null,
          claudeMdContent: claudeMdContent || null,
          modulesContent: Object.keys(modulesContent).length > 0 ? modulesContent : null,
          cursorModulesContent: Object.keys(cursorModulesContent).length > 0 ? cursorModulesContent : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create version');

      toast.success('Content version created');
      setShowCreateDialog(false);
      resetForm();
      fetchVersions();
    } catch (error) {
      toast.error('Failed to create content version');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePublish = async (versionId: string) => {
    setIsPublishing(versionId);
    try {
      const response = await fetch(`/api/admin/content/${versionId}/publish`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to publish version');

      toast.success('Version published! Users will now receive this content.');
      fetchVersions();
    } catch (error) {
      toast.error('Failed to publish version');
    } finally {
      setIsPublishing(null);
    }
  };

  const handleDelete = async (versionId: string) => {
    if (!confirm('Are you sure you want to delete this version?')) return;

    try {
      const response = await fetch(`/api/admin/content/${versionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.data?.error || 'Failed to delete version');
      }

      toast.success('Version deleted');
      fetchVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete version');
    }
  };

  const handleView = async (versionId: string) => {
    try {
      const response = await fetch(`/api/admin/content/${versionId}`);
      if (!response.ok) throw new Error('Failed to fetch version');
      const data = await response.json();
      setSelectedVersion(data.data.version);
      setShowViewDialog(true);
    } catch (error) {
      toast.error('Failed to load version details');
    }
  };

  const resetForm = () => {
    setNewVersion('');
    setChangelog('');
    setCursorRulesContent('');
    setClaudeMdContent('');
    setModulesContent({});
    setCursorModulesContent({});
  };

  const activeVersion = versions.find((v) => v.isActive);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="h-8 w-8 text-red-400" />
            Content Management
          </h1>
          <p className="text-slate-400 mt-1">
            Upload and manage pattern files for users
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncFromServer}
            disabled={isSyncing}
            variant="outline"
            className="border-green-600 text-green-400 hover:bg-green-900/20"
            title="Sync .claude/ folder from deployed Vercel instance"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from Deployed
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Version
          </Button>
        </div>
      </div>

      {/* Active Version Card */}
      {activeVersion && (
        <Card className="bg-green-900/20 border-green-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-400" />
                  Active Version: {activeVersion.version}
                </CardTitle>
                <CardDescription className="text-green-300">
                  Published {activeVersion.publishedAt
                    ? new Date(activeVersion.publishedAt).toLocaleDateString()
                    : 'N/A'}
                  {activeVersion.publisherEmail && ` by ${activeVersion.publisherEmail}`}
                </CardDescription>
              </div>
              <Badge className="bg-green-600">Live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Content Stats for Active Version */}
            <div className="flex flex-wrap gap-3 mb-3">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                activeVersion.hasClaudeMd ? 'bg-green-800/50 text-green-200' : 'bg-slate-800 text-slate-500'
              }`}>
                <FileText className="h-3 w-3" />
                <span>CLAUDE.md</span>
                {activeVersion.hasClaudeMd && (
                  <span className="font-medium">{activeVersion.claudeMdLines.toLocaleString()} lines</span>
                )}
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                activeVersion.hasCursorRules ? 'bg-green-800/50 text-green-200' : 'bg-slate-800 text-slate-500'
              }`}>
                <FileCode className="h-3 w-3" />
                <span>.cursorrules</span>
                {activeVersion.hasCursorRules && (
                  <span className="font-medium">{activeVersion.cursorRulesLines.toLocaleString()} lines</span>
                )}
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                activeVersion.moduleCount > 0 ? 'bg-green-800/50 text-green-200' : 'bg-slate-800 text-slate-500'
              }`}>
                <File className="h-3 w-3" />
                <span>.claude/</span>
                <span className="font-medium">{activeVersion.moduleCount} modules</span>
              </div>
              {activeVersion.cursorModuleCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-green-800/50 text-green-200">
                  <File className="h-3 w-3" />
                  <span>.cursorrules-modules/</span>
                  <span className="font-medium">{activeVersion.cursorModuleCount} modules</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-green-800/50 text-green-200">
                <span>Total:</span>
                <span className="font-medium">{activeVersion.totalLines.toLocaleString()} lines</span>
              </div>
            </div>
            {activeVersion.changelog && (
              <p className="text-sm text-green-200/70 italic">{activeVersion.changelog}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Version History</CardTitle>
          <CardDescription className="text-slate-400">
            All uploaded content versions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No content versions yet</p>
              <p className="text-sm">Upload your first version to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    version.isActive
                      ? 'border-green-600/50 bg-green-900/10'
                      : 'border-slate-700 bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-lg">
                          v{version.version}
                        </span>
                        {version.isActive && (
                          <Badge className="bg-green-600">Active</Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Created {new Date(version.createdAt).toLocaleDateString()}
                        {version.publisherEmail && ` by ${version.publisherEmail}`}
                      </div>

                      {/* Content Stats */}
                      <div className="flex flex-wrap gap-3 mt-3">
                        {/* CLAUDE.md */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          version.hasClaudeMd ? 'bg-blue-900/30 text-blue-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <FileText className="h-3 w-3" />
                          <span>CLAUDE.md</span>
                          {version.hasClaudeMd && (
                            <span className="text-blue-400 font-medium">{version.claudeMdLines.toLocaleString()} lines</span>
                          )}
                        </div>

                        {/* .cursorrules */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          version.hasCursorRules ? 'bg-purple-900/30 text-purple-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <FileCode className="h-3 w-3" />
                          <span>.cursorrules</span>
                          {version.hasCursorRules && (
                            <span className="text-purple-400 font-medium">{version.cursorRulesLines.toLocaleString()} lines</span>
                          )}
                        </div>

                        {/* Modules */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          version.moduleCount > 0 ? 'bg-green-900/30 text-green-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <File className="h-3 w-3" />
                          <span>.claude/</span>
                          <span className={version.moduleCount > 0 ? 'text-green-400 font-medium' : ''}>
                            {version.moduleCount} modules
                          </span>
                        </div>

                        {/* Cursor Modules (if any) */}
                        {version.cursorModuleCount > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-purple-900/30 text-purple-300">
                            <File className="h-3 w-3" />
                            <span>.cursorrules-modules/</span>
                            <span className="text-purple-400 font-medium">{version.cursorModuleCount} modules</span>
                          </div>
                        )}

                        {/* Total Lines */}
                        {version.totalLines > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-slate-800 text-slate-300">
                            <span>Total:</span>
                            <span className="text-white font-medium">{version.totalLines.toLocaleString()} lines</span>
                          </div>
                        )}
                      </div>

                      {version.changelog && (
                        <p className="text-sm text-slate-400 mt-2 italic">
                          {version.changelog}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleView(version.id)}
                        className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      {!version.isActive && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePublish(version.id)}
                            disabled={isPublishing === version.id}
                            className="border-green-600 text-green-400 hover:bg-green-900/20"
                          >
                            {isPublishing === version.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Rocket className="h-3 w-3 mr-1" />
                            )}
                            Publish
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(version.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Version Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Version</DialogTitle>
            <DialogDescription className="text-slate-400">
              Upload pattern files for a new content version
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Version Number */}
            <div className="space-y-2">
              <Label className="text-white">Version Number *</Label>
              <Input
                placeholder="e.g., 16.0"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Changelog */}
            <div className="space-y-2">
              <Label className="text-white">Changelog</Label>
              <Textarea
                placeholder="What changed in this version?"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
              />
            </div>

            {/* File Uploads - Simple 3 files */}
            <div className="space-y-4">
              <Label className="text-white text-base">Upload Your Files</Label>
              <p className="text-slate-400 text-sm">Upload the 3 pattern files from your project:</p>

              {/* 1. CLAUDE.md */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium flex items-center gap-2">
                      1. CLAUDE.md
                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">Required</Badge>
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Main router file with commands, intent detection, and module reference table
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={claudeInputRef}
                      onChange={(e) => handleFileUpload(e, 'claude')}
                      accept=".md"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={claudeMdContent ? 'default' : 'outline'}
                      onClick={() => claudeInputRef.current?.click()}
                      className={claudeMdContent ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600'}
                    >
                      {claudeMdContent ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Loaded
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {claudeMdContent && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Lines:</span>
                        <span className="text-green-400 ml-2">{countLines(claudeMdContent).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Size:</span>
                        <span className="text-green-400 ml-2">{formatSize(claudeMdContent)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Sections:</span>
                        <span className="text-green-400 ml-2">{(claudeMdContent.match(/^##\s/gm) || []).length}</span>
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-slate-800 rounded text-xs text-slate-400 font-mono max-h-20 overflow-hidden">
                      {claudeMdContent.split('\n').slice(0, 5).join('\n')}...
                    </div>
                  </div>
                )}
              </div>

              {/* 2. .cursorrules */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium flex items-center gap-2">
                      2. .cursorrules
                      <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">Cursor IDE</Badge>
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Rules file for Cursor IDE users - similar to CLAUDE.md but formatted for Cursor
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={cursorInputRef}
                      onChange={(e) => handleFileUpload(e, 'cursor')}
                      accept="*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={cursorRulesContent ? 'default' : 'outline'}
                      onClick={() => cursorInputRef.current?.click()}
                      className={cursorRulesContent ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600'}
                    >
                      {cursorRulesContent ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Loaded
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {cursorRulesContent && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Lines:</span>
                        <span className="text-purple-400 ml-2">{countLines(cursorRulesContent).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Size:</span>
                        <span className="text-purple-400 ml-2">{formatSize(cursorRulesContent)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Sections:</span>
                        <span className="text-purple-400 ml-2">{(cursorRulesContent.match(/^##\s/gm) || []).length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. .claude folder */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium flex items-center gap-2">
                      3. .claude/ folder
                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">Required</Badge>
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Pattern modules for Claude Code (00-core.md through 39-self-healing.md)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={modulesInputRef}
                      onChange={(e) => handleFileUpload(e, 'modules')}
                      accept=".md"
                      // @ts-expect-error - webkitdirectory is not in React types
                      webkitdirectory=""
                      directory=""
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={Object.keys(modulesContent).length > 0 ? 'default' : 'outline'}
                      onClick={() => modulesInputRef.current?.click()}
                      className={Object.keys(modulesContent).length > 0 ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600'}
                    >
                      {Object.keys(modulesContent).length > 0 ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          {Object.keys(modulesContent).length} files
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Select Folder
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {Object.keys(modulesContent).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-4 text-xs mb-3">
                      <div>
                        <span className="text-slate-400">Modules:</span>
                        <span className="text-green-400 ml-2">{Object.keys(modulesContent).length}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Total Lines:</span>
                        <span className="text-green-400 ml-2">
                          {Object.values(modulesContent).reduce((acc, c) => acc + countLines(c), 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Total Size:</span>
                        <span className="text-green-400 ml-2">
                          {formatSize(Object.values(modulesContent).join(''))}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedModules(!expandedModules)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300"
                    >
                      {expandedModules ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {expandedModules ? 'Hide' : 'Show'} module details
                    </button>
                    {expandedModules && (
                      <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                        {Object.entries(modulesContent).sort(([a], [b]) => a.localeCompare(b)).map(([name, content]) => (
                          <div key={name} className="text-xs flex items-center justify-between py-1 px-2 rounded bg-slate-800/50">
                            <div className="flex items-center gap-2">
                              <FileCode className="h-3 w-3 text-blue-400" />
                              <span className="text-white font-mono">{name}</span>
                              <span className="text-slate-400">{getModuleDescription(name, content)}</span>
                            </div>
                            <span className="text-slate-400">{countLines(content).toLocaleString()} lines</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. .cursorrules-modules folder */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium flex items-center gap-2">
                      4. .cursorrules-modules/ folder
                      <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">Cursor IDE</Badge>
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Pattern modules for Cursor IDE users (same modules, formatted for Cursor)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={cursorModulesInputRef}
                      onChange={(e) => handleFileUpload(e, 'cursorModules')}
                      accept=".md"
                      // @ts-expect-error - webkitdirectory is not in React types
                      webkitdirectory=""
                      directory=""
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={Object.keys(cursorModulesContent).length > 0 ? 'default' : 'outline'}
                      onClick={() => cursorModulesInputRef.current?.click()}
                      className={Object.keys(cursorModulesContent).length > 0 ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600'}
                    >
                      {Object.keys(cursorModulesContent).length > 0 ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          {Object.keys(cursorModulesContent).length} files
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Select Folder
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {Object.keys(cursorModulesContent).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-4 text-xs mb-3">
                      <div>
                        <span className="text-slate-400">Modules:</span>
                        <span className="text-purple-400 ml-2">{Object.keys(cursorModulesContent).length}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Total Lines:</span>
                        <span className="text-purple-400 ml-2">
                          {Object.values(cursorModulesContent).reduce((acc, c) => acc + countLines(c), 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Total Size:</span>
                        <span className="text-purple-400 ml-2">
                          {formatSize(Object.values(cursorModulesContent).join(''))}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedCursorModules(!expandedCursorModules)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300"
                    >
                      {expandedCursorModules ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {expandedCursorModules ? 'Hide' : 'Show'} module details
                    </button>
                    {expandedCursorModules && (
                      <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                        {Object.entries(cursorModulesContent).sort(([a], [b]) => a.localeCompare(b)).map(([name, content]) => (
                          <div key={name} className="text-xs flex items-center justify-between py-1 px-2 rounded bg-slate-800/50">
                            <div className="flex items-center gap-2">
                              <FileCode className="h-3 w-3 text-purple-400" />
                              <span className="text-white font-mono">{name}</span>
                              <span className="text-slate-400">{getModuleDescription(name, content)}</span>
                            </div>
                            <span className="text-slate-400">{countLines(content).toLocaleString()} lines</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newVersion.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Version Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Version {selectedVersion?.version}
              {selectedVersion?.isActive && (
                <Badge className="ml-2 bg-green-600">Active</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Content details for this version
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-4 py-4">
              {selectedVersion.changelog && (
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400 mb-1">Changelog:</p>
                  <p className="text-sm text-slate-300">{selectedVersion.changelog}</p>
                </div>
              )}

              <div className="space-y-3">
                {/* CLAUDE.md */}
                <div className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-slate-400" />
                    <span className="text-white">CLAUDE.md</span>
                  </div>
                  <span className={selectedVersion.claudeMdContent ? 'text-green-400' : 'text-slate-400'}>
                    {selectedVersion.claudeMdContent
                      ? `${selectedVersion.claudeMdContent.split('\n').length} lines`
                      : 'Not uploaded'}
                  </span>
                </div>

                {/* .cursorrules */}
                <div className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-slate-400" />
                    <span className="text-white">.cursorrules</span>
                  </div>
                  <span className={selectedVersion.cursorRulesContent ? 'text-green-400' : 'text-slate-400'}>
                    {selectedVersion.cursorRulesContent
                      ? `${selectedVersion.cursorRulesContent.split('\n').length} lines`
                      : 'Not uploaded'}
                  </span>
                </div>

                {/* .claude folder */}
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-slate-400" />
                      <span className="text-white">.claude/ folder</span>
                    </div>
                    <span className={Object.keys(selectedVersion.modulesContent || {}).length > 0 ? 'text-green-400' : 'text-slate-400'}>
                      {Object.keys(selectedVersion.modulesContent || {}).length} files
                    </span>
                  </div>
                  {Object.keys(selectedVersion.modulesContent || {}).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                      {Object.keys(selectedVersion.modulesContent).sort().map((name) => (
                        <div key={name} className="text-xs text-slate-400 flex items-center gap-1">
                          <FileCode className="h-3 w-3" />
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* .cursorrules-modules folder */}
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-slate-400" />
                      <span className="text-white">.cursorrules-modules/ folder</span>
                    </div>
                    <span className={Object.keys(selectedVersion.cursorModulesContent || {}).length > 0 ? 'text-green-400' : 'text-slate-400'}>
                      {Object.keys(selectedVersion.cursorModulesContent || {}).length} files
                    </span>
                  </div>
                  {Object.keys(selectedVersion.cursorModulesContent || {}).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                      {Object.keys(selectedVersion.cursorModulesContent).sort().map((name) => (
                        <div key={name} className="text-xs text-slate-400 flex items-center gap-1">
                          <FileCode className="h-3 w-3" />
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowViewDialog(false)}
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
