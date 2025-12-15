'use client';

import { Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="h-8 w-8 text-red-400" />
          Admin Settings
        </h1>
        <p className="text-slate-400 mt-1">
          Configure system settings and preferences
        </p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Coming Soon</CardTitle>
          <CardDescription className="text-slate-400">
            Admin settings and configuration options will be available here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm">
            Future features may include:
          </p>
          <ul className="text-slate-400 text-sm mt-2 space-y-1 list-disc list-inside">
            <li>Email notification settings</li>
            <li>System-wide limits and quotas</li>
            <li>Feature flags</li>
            <li>Audit logs</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
