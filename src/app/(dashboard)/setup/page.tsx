'use client';

import { useState, useEffect } from 'react';
import { Loader2, Copy, Check, Plus, Trash2, Key, Terminal, TestTube2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function SetupPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (!response.ok) throw new Error('Failed to fetch keys');
      const data = await response.json();
      setApiKeys(data.data);
    } catch (error) {
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const createApiKey = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      });

      if (!response.ok) throw new Error('Failed to create key');

      const data = await response.json();
      setNewKey(data.data.key);
      await fetchApiKeys();
      setNewKeyName('');
      toast.success('API key created');
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      const response = await fetch(`/api/keys?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete key');

      await fetchApiKeys();
      toast.success('API key deleted');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Setup</h1>
        <p className="text-neutral-400 mt-1">
          Configure the CLI and manage your API keys
        </p>
      </div>

      {/* Installation Steps */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-red-400" />
              <CardTitle className="text-white">Install CLI</CardTitle>
            </div>
            <CardDescription>
              Install the CodeBakers CLI globally
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <code className="block rounded bg-neutral-900 px-4 py-3 font-mono text-sm text-red-400">
              npm install -g @codebakers/cli
            </code>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-red-400" />
              <CardTitle className="text-white">Login</CardTitle>
            </div>
            <CardDescription>
              Authenticate with your API key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <code className="block rounded bg-neutral-900 px-4 py-3 font-mono text-sm text-red-400">
              codebakers login
            </code>
            <p className="text-sm text-neutral-400">
              You'll be prompted to enter your API key
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-red-400" />
              <CardTitle className="text-white">Install Patterns</CardTitle>
            </div>
            <CardDescription>
              Download patterns to your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <code className="block rounded bg-neutral-900 px-4 py-3 font-mono text-sm text-red-400">
              codebakers install
            </code>
            <p className="text-sm text-neutral-400">
              Run this in your project root directory
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-red-400" />
              <CardTitle className="text-white">Setup Testing</CardTitle>
            </div>
            <CardDescription>
              Enable automatic testing with Playwright
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <code className="block rounded bg-neutral-900 px-4 py-3 font-mono text-sm text-red-400">
              npm install -D @playwright/test && npx playwright install
            </code>
          </CardContent>
        </Card>
      </div>

      {/* API Keys Management */}
      <Card className="bg-neutral-800/50 border-neutral-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">API Keys</CardTitle>
            <CardDescription>
              Manage your API keys for CLI authentication
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-800 border-neutral-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create API Key</DialogTitle>
                <DialogDescription>
                  Create a new API key for CLI access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {newKey ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-yellow-900/20 border border-yellow-600/50 p-4">
                      <p className="text-sm text-yellow-400 font-medium mb-2">
                        Save this key! It won't be shown again.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-300 break-all">
                          {newKey}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyKey(newKey)}
                          className="border-neutral-600 flex-shrink-0"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setNewKey(null);
                        setDialogOpen(false);
                      }}
                      className="w-full"
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Key name (optional)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="bg-neutral-700 border-neutral-600 text-white"
                    />
                    <Button
                      onClick={createApiKey}
                      disabled={isCreating}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Key'
                      )}
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              No API keys yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-700">
                  <TableHead className="text-neutral-300">Name</TableHead>
                  <TableHead className="text-neutral-300">Key Prefix</TableHead>
                  <TableHead className="text-neutral-300">Status</TableHead>
                  <TableHead className="text-neutral-300">Last Used</TableHead>
                  <TableHead className="text-neutral-300">Created</TableHead>
                  <TableHead className="text-neutral-300 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id} className="border-neutral-700">
                    <TableCell className="text-white font-medium">
                      {key.name}
                    </TableCell>
                    <TableCell className="font-mono text-neutral-400">
                      {key.keyPrefix}...
                    </TableCell>
                    <TableCell>
                      {key.isActive ? (
                        <Badge className="bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-neutral-600">
                          Revoked
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-400">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-neutral-400">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteApiKey(key.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
