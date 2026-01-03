'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Loader2,
  RefreshCw,
  Save,
  History,
  ToggleLeft,
  ToggleRight,
  Mail,
  Gauge,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AdminSetting {
  id: string;
  key: string;
  value: string;
  type: string | null;
  description: string | null;
  category: string | null;
  updatedAt: string | null;
}

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string | null;
}

interface SettingsData {
  settings: Record<string, AdminSetting[]>;
  categories: string[];
}

interface AuditLogsData {
  logs: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: {
    actions: { value: string; count: number }[];
    resources: { value: string; count: number }[];
  };
}

const CATEGORY_ICONS: Record<string, typeof Settings> = {
  general: Settings,
  limits: Gauge,
  features: Sparkles,
  email: Mail,
};

const CATEGORY_COLORS: Record<string, string> = {
  general: 'text-blue-400',
  limits: 'text-orange-400',
  features: 'text-purple-400',
  email: 'text-green-400',
};

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'audit'>('settings');
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [auditData, setAuditData] = useState<AuditLogsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [saveSuccess, setSaveSuccess] = useState<Set<string>>(new Set());

  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState<string | null>(null);
  const [auditResource, setAuditResource] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(0);

  const fetchSettings = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const json = await res.json();
      setSettingsData(json.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchAuditLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('offset', (auditPage * 20).toString());
      if (auditSearch) params.set('search', auditSearch);
      if (auditAction) params.set('action', auditAction);
      if (auditResource) params.set('resource', auditResource);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const json = await res.json();
      setAuditData(json.data);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  }, [auditPage, auditSearch, auditAction, auditResource]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  const handleSettingChange = (key: string, value: string) => {
    setEditingSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggle = async (setting: AdminSetting) => {
    const newValue = setting.value === 'true' ? 'false' : 'true';
    await saveSetting(setting.key, newValue);
  };

  const saveSetting = async (key: string, value: string) => {
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) throw new Error('Failed to save setting');

      // Update local state
      setSettingsData((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        Object.keys(updated.settings).forEach((cat) => {
          updated.settings[cat] = updated.settings[cat].map((s) =>
            s.key === key ? { ...s, value } : s
          );
        });
        return updated;
      });

      // Clear editing state
      setEditingSettings((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      // Show success indicator
      setSaveSuccess((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setSaveSuccess((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const getCurrentValue = (setting: AdminSetting) => {
    return editingSettings[setting.key] !== undefined
      ? editingSettings[setting.key]
      : setting.value;
  };

  const hasChanges = (setting: AdminSetting) => {
    return editingSettings[setting.key] !== undefined &&
      editingSettings[setting.key] !== setting.value;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalAuditPages = auditData ? Math.ceil(auditData.pagination.total / 20) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="h-8 w-8 text-red-400" />
            Admin Settings
          </h1>
          <p className="text-slate-400 mt-1">
            Configure system settings and view audit logs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSettings(true)}
          disabled={isRefreshing}
          className="border-slate-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('settings')}
          className={activeTab === 'settings' ? 'bg-blue-600' : 'text-slate-400'}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('audit')}
          className={activeTab === 'audit' ? 'bg-blue-600' : 'text-slate-400'}
        >
          <History className="h-4 w-4 mr-2" />
          Audit Logs
        </Button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && settingsData && (
        <div className="space-y-6">
          {settingsData.categories.map((category) => {
            const Icon = CATEGORY_ICONS[category] || Settings;
            const colorClass = CATEGORY_COLORS[category] || 'text-slate-400';

            return (
              <Card key={category} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 capitalize">
                    <Icon className={`h-5 w-5 ${colorClass}`} />
                    {category} Settings
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Configure {category} options
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {settingsData.settings[category]?.map((setting) => (
                      <div
                        key={setting.key}
                        className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0"
                      >
                        <div className="flex-1 mr-4">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">
                              {setting.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </p>
                            {saveSuccess.has(setting.key) && (
                              <Check className="h-4 w-4 text-green-400" />
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{setting.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {setting.type === 'boolean' ? (
                            <button
                              onClick={() => handleToggle(setting)}
                              disabled={savingKeys.has(setting.key)}
                              className="focus:outline-none"
                            >
                              {savingKeys.has(setting.key) ? (
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                              ) : setting.value === 'true' ? (
                                <ToggleRight className="h-8 w-8 text-green-400" />
                              ) : (
                                <ToggleLeft className="h-8 w-8 text-slate-400" />
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type={setting.type === 'number' ? 'number' : 'text'}
                                value={getCurrentValue(setting)}
                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                className="w-48 bg-slate-900/50 border-slate-700 text-white"
                              />
                              {hasChanges(setting) && (
                                <Button
                                  size="sm"
                                  onClick={() => saveSetting(setting.key, editingSettings[setting.key])}
                                  disabled={savingKeys.has(setting.key)}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {savingKeys.has(setting.key) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by email..."
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value);
                      setAuditPage(0);
                    }}
                    className="pl-10 bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>

                <select
                  value={auditAction || ''}
                  onChange={(e) => {
                    setAuditAction(e.target.value || null);
                    setAuditPage(0);
                  }}
                  className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white"
                >
                  <option value="">All Actions</option>
                  {auditData?.filters.actions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.value} ({a.count})
                    </option>
                  ))}
                </select>

                <select
                  value={auditResource || ''}
                  onChange={(e) => {
                    setAuditResource(e.target.value || null);
                    setAuditPage(0);
                  }}
                  className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white"
                >
                  <option value="">All Resources</option>
                  {auditData?.filters.resources.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value} ({r.count})
                    </option>
                  ))}
                </select>

                {(auditSearch || auditAction || auditResource) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAuditSearch('');
                      setAuditAction(null);
                      setAuditResource(null);
                      setAuditPage(0);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logs List */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Audit Logs</CardTitle>
              <CardDescription className="text-slate-400">
                {auditData?.pagination.total || 0} events logged
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditData?.logs && auditData.logs.length > 0 ? (
                <div className="space-y-3">
                  {auditData.logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-slate-800">
                            <History className="h-4 w-4 text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                {log.action}
                              </span>
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30">
                                {log.resource}
                              </span>
                              {log.resourceId && (
                                <span className="text-xs text-slate-500">
                                  ID: {log.resourceId}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white mt-1">
                              {log.userName || log.userEmail || 'System'}
                            </p>

                            {/* Show changes for setting updates */}
                            {log.action === 'setting.update' && log.previousValue && log.newValue && (
                              <div className="mt-2 text-xs">
                                <span className="text-red-400 line-through">
                                  {JSON.stringify(log.previousValue)}
                                </span>
                                <span className="text-slate-400 mx-2">→</span>
                                <span className="text-green-400">
                                  {JSON.stringify(log.newValue)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right text-sm">
                          <div className="flex items-center gap-1 text-slate-400">
                            <Calendar className="h-3 w-3" />
                            {log.createdAt && new Date(log.createdAt).toLocaleDateString()}
                          </div>
                          <p className="text-xs text-slate-500">
                            {log.createdAt && new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-400">No audit logs found</p>
                </div>
              )}

              {/* Pagination */}
              {totalAuditPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Page {auditPage + 1} of {totalAuditPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                      disabled={auditPage === 0}
                      className="border-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAuditPage((p) => p + 1)}
                      disabled={!auditData?.pagination.hasMore}
                      className="border-slate-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
