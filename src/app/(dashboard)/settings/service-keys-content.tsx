'use client';

import { useState } from 'react';
import { Key, Github, Database, Cloud, Loader2, Eye, EyeOff, Trash2, Save, Info, Brain, CreditCard, Bug, Image, Camera, Sparkles, Phone, Mail, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

// All supported service keys
type ServiceKey = 'github' | 'supabase' | 'vercel' | 'openai' | 'anthropic' | 'stripe' | 'sentry' | 'cloudinary' | 'pexels' | 'midjourney' | 'twilio_sid' | 'twilio_auth' | 'resend' | 'vapi';

interface ServiceKeysContentProps {
  initialKeys: Record<string, boolean>;
}

interface ServiceConfig {
  key: ServiceKey;
  name: string;
  description: string;
  icon: React.ReactNode;
  helpUrl: string;
  helpText: string;
  placeholder: string;
  category: 'infrastructure' | 'ai' | 'payments' | 'monitoring' | 'media' | 'communication';
}

const services: ServiceConfig[] = [
  // Infrastructure
  {
    key: 'github',
    name: 'GitHub',
    description: 'Create repositories automatically during project scaffolding',
    icon: <Github className="h-5 w-5" />,
    helpUrl: 'https://github.com/settings/tokens',
    helpText: 'Create a Personal Access Token with repo scope',
    placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    category: 'infrastructure',
  },
  {
    key: 'supabase',
    name: 'Supabase',
    description: 'Auto-provision Supabase projects with database and auth',
    icon: <Database className="h-5 w-5" />,
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    helpText: 'Create an Access Token from your account settings',
    placeholder: 'sbp_xxxxxxxxxxxxxxxxxxxx',
    category: 'infrastructure',
  },
  {
    key: 'vercel',
    name: 'Vercel',
    description: 'Deploy projects automatically to Vercel',
    icon: <Cloud className="h-5 w-5" />,
    helpUrl: 'https://vercel.com/account/tokens',
    helpText: 'Create a new token from your account settings',
    placeholder: 'vercel_xxxxxxxxxxxxxxxxxxxx',
    category: 'infrastructure',
  },
  // AI
  {
    key: 'openai',
    name: 'OpenAI',
    description: 'GPT models, DALL-E, Whisper, and embeddings',
    icon: <Brain className="h-5 w-5" />,
    helpUrl: 'https://platform.openai.com/api-keys',
    helpText: 'Create an API key from your OpenAI dashboard',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    category: 'ai',
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    description: 'Claude API for AI-powered features',
    icon: <Sparkles className="h-5 w-5" />,
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpText: 'Create an API key from your Anthropic console',
    placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxx',
    category: 'ai',
  },
  // Payments
  {
    key: 'stripe',
    name: 'Stripe',
    description: 'Payment processing, subscriptions, and billing',
    icon: <CreditCard className="h-5 w-5" />,
    helpUrl: 'https://dashboard.stripe.com/apikeys',
    helpText: 'Use your Secret Key (starts with sk_)',
    placeholder: 'sk_live_xxxxxxxxxxxxxxxxxxxx',
    category: 'payments',
  },
  // Monitoring
  {
    key: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and performance monitoring',
    icon: <Bug className="h-5 w-5" />,
    helpUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
    helpText: 'Create an Auth Token with project:write scope',
    placeholder: 'sntrys_xxxxxxxxxxxxxxxxxxxx',
    category: 'monitoring',
  },
  // Media
  {
    key: 'cloudinary',
    name: 'Cloudinary',
    description: 'Image and video upload, transformation, and CDN',
    icon: <Image className="h-5 w-5" />,
    helpUrl: 'https://console.cloudinary.com/settings/api-keys',
    helpText: 'Copy your API Secret from the dashboard',
    placeholder: 'cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
    category: 'media',
  },
  {
    key: 'pexels',
    name: 'Pexels',
    description: 'Free stock photos and videos API',
    icon: <Camera className="h-5 w-5" />,
    helpUrl: 'https://www.pexels.com/api/new/',
    helpText: 'Get your free API key from Pexels',
    placeholder: 'xxxxxxxxxxxxxxxxxxxx',
    category: 'media',
  },
  {
    key: 'midjourney',
    name: 'Midjourney',
    description: 'AI image generation (via proxy API)',
    icon: <Sparkles className="h-5 w-5" />,
    helpUrl: 'https://docs.midjourney.com/',
    helpText: 'Midjourney API key or proxy service token',
    placeholder: 'mj_xxxxxxxxxxxxxxxxxxxx',
    category: 'media',
  },
  // Communication
  {
    key: 'twilio_sid',
    name: 'Twilio Account SID',
    description: 'Your Twilio Account SID (starts with AC)',
    icon: <Phone className="h-5 w-5" />,
    helpUrl: 'https://console.twilio.com/',
    helpText: 'Find your Account SID in the Twilio Console',
    placeholder: 'ACxxxxxxxxxxxxxxxxxxxx',
    category: 'communication',
  },
  {
    key: 'twilio_auth',
    name: 'Twilio Auth Token',
    description: 'Your Twilio Auth Token for API authentication',
    icon: <Phone className="h-5 w-5" />,
    helpUrl: 'https://console.twilio.com/',
    helpText: 'Find your Auth Token in the Twilio Console',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    category: 'communication',
  },
  {
    key: 'resend',
    name: 'Resend',
    description: 'Transactional email API for developers',
    icon: <Mail className="h-5 w-5" />,
    helpUrl: 'https://resend.com/api-keys',
    helpText: 'Create an API key from your Resend dashboard',
    placeholder: 're_xxxxxxxxxxxxxxxxxxxx',
    category: 'communication',
  },
  {
    key: 'vapi',
    name: 'VAPI',
    description: 'Voice AI platform for phone agents',
    icon: <Mic className="h-5 w-5" />,
    helpUrl: 'https://dashboard.vapi.ai/',
    helpText: 'Get your API key from VAPI dashboard',
    placeholder: 'vapi_xxxxxxxxxxxxxxxxxxxx',
    category: 'communication',
  },
];

const categoryLabels: Record<string, { label: string; description: string }> = {
  infrastructure: { label: 'Infrastructure', description: 'Project setup and deployment' },
  ai: { label: 'AI & LLMs', description: 'AI models and language APIs' },
  payments: { label: 'Payments', description: 'Payment processing' },
  communication: { label: 'Communication', description: 'SMS, email, and voice' },
  monitoring: { label: 'Monitoring', description: 'Error tracking and analytics' },
  media: { label: 'Media', description: 'Images, videos, and assets' },
};

export function ServiceKeysContent({ initialKeys }: ServiceKeysContentProps) {
  // Initialize all keys as empty strings
  const [keys, setKeys] = useState<Record<string, string>>(
    Object.fromEntries(services.map(s => [s.key, '']))
  );
  const [configured, setConfigured] = useState(initialKeys);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const handleSave = async (serviceKey: ServiceKey) => {
    const value = keys[serviceKey];
    if (!value) {
      toast.error('Please enter a key');
      return;
    }

    setSaving({ ...saving, [serviceKey]: true });
    try {
      const response = await fetch('/api/team/service-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [serviceKey]: value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save key');
      }

      setConfigured({ ...configured, [serviceKey]: true });
      setKeys({ ...keys, [serviceKey]: '' });
      toast.success(`${services.find(s => s.key === serviceKey)?.name} key saved!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save key');
    } finally {
      setSaving({ ...saving, [serviceKey]: false });
    }
  };

  const handleDelete = async (serviceKey: ServiceKey) => {
    setDeleting({ ...deleting, [serviceKey]: true });
    try {
      const response = await fetch(`/api/team/service-keys?service=${serviceKey}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete key');
      }

      setConfigured({ ...configured, [serviceKey]: false });
      toast.success(`${services.find(s => s.key === serviceKey)?.name} key removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete key');
    } finally {
      setDeleting({ ...deleting, [serviceKey]: false });
    }
  };

  const configuredCount = Object.values(configured).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-neutral-400 mt-1">
          Manage your service API keys for auto-provisioning
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-900/20 border-blue-800">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-200">
          Service keys are synced to your CLI and auto-populate your <code className="bg-blue-900/50 px-1 rounded">.env.local</code> during project setup.
          Keys are encrypted and stored securely. You can also enter different keys per project for client work.
        </AlertDescription>
      </Alert>

      {/* Overview Card */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-neutral-300">
            Service Keys
          </CardTitle>
          <Key className="h-4 w-4 text-neutral-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {configuredCount} / {services.length}
          </div>
          <p className="text-xs text-neutral-400">services configured</p>
        </CardContent>
      </Card>

      {/* Service Key Cards - Grouped by Category */}
      {(['infrastructure', 'ai', 'payments', 'communication', 'monitoring', 'media'] as const).map((category) => {
        const categoryServices = services.filter(s => s.category === category);
        if (categoryServices.length === 0) return null;

        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{categoryLabels[category].label}</h2>
              <span className="text-sm text-neutral-500">{categoryLabels[category].description}</span>
            </div>

            {categoryServices.map((service) => (
          <Card key={service.key} className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-800 rounded-lg text-neutral-300">
                    {service.icon}
                  </div>
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      {service.name}
                      {configured[service.key] && (
                        <Badge className="bg-green-600">Configured</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {configured[service.key] ? (
                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Key className="h-4 w-4" />
                    <span className="font-mono">••••••••••••••••</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(service.key)}
                    disabled={deleting[service.key]}
                    className="text-neutral-400 hover:text-red-400"
                  >
                    {deleting[service.key] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-neutral-300">API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKey[service.key] ? 'text' : 'password'}
                          placeholder={service.placeholder}
                          value={keys[service.key]}
                          onChange={(e) => setKeys({ ...keys, [service.key]: e.target.value })}
                          className="bg-neutral-800 border-neutral-700 text-white pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 text-neutral-400 hover:text-white"
                          onClick={() => setShowKey({ ...showKey, [service.key]: !showKey[service.key] })}
                        >
                          {showKey[service.key] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleSave(service.key)}
                        disabled={saving[service.key] || !keys[service.key]}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {saving[service.key] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-400">
                    {service.helpText}.{' '}
                    <a
                      href={service.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 underline"
                    >
                      Get your key
                    </a>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
            ))}
          </div>
        );
      })}

      {/* Usage Instructions */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-neutral-300">
          <div className="space-y-2">
            <p className="font-medium text-white">1. Add your API keys above</p>
            <p className="text-sm text-neutral-400">
              Keys are synced to your CLI automatically when you run commands.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-white">2. Run scaffold command</p>
            <pre className="bg-neutral-800 p-3 rounded text-sm font-mono">
              codebakers scaffold
            </pre>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-white">3. Choose to use saved keys</p>
            <p className="text-sm text-neutral-400">
              The CLI will offer to use your saved keys or enter new ones for client projects.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
