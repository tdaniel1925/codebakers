import Conf from 'conf';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Canonical list of ALL supported service keys
 * This must match the server contract at src/lib/contracts/service-keys.ts
 */
export const SERVICE_KEYS = [
  // Infrastructure (provisioning-capable)
  'github',
  'supabase',
  'vercel',
  // AI
  'openai',
  'anthropic',
  // Payments
  'stripe',
  // Communication
  'twilio_sid',
  'twilio_auth',
  'resend',
  'vapi',
  // Monitoring
  'sentry',
  // Media
  'cloudinary',
  'pexels',
  'midjourney',
] as const;

export type ServiceName = typeof SERVICE_KEYS[number];

/**
 * Map service key names to environment variable names
 */
export const ENV_VAR_NAMES: Record<ServiceName, string> = {
  github: 'GITHUB_TOKEN',
  supabase: 'SUPABASE_ACCESS_TOKEN',
  vercel: 'VERCEL_TOKEN',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  stripe: 'STRIPE_SECRET_KEY',
  twilio_sid: 'TWILIO_ACCOUNT_SID',
  twilio_auth: 'TWILIO_AUTH_TOKEN',
  resend: 'RESEND_API_KEY',
  vapi: 'VAPI_API_KEY',
  sentry: 'SENTRY_DSN',
  cloudinary: 'CLOUDINARY_API_SECRET',
  pexels: 'PEXELS_API_KEY',
  midjourney: 'MIDJOURNEY_API_KEY',
};

/**
 * Service key categories for display grouping
 */
export const SERVICE_KEY_CATEGORIES: Record<string, ServiceName[]> = {
  infrastructure: ['github', 'supabase', 'vercel'],
  ai: ['openai', 'anthropic'],
  payments: ['stripe'],
  communication: ['twilio_sid', 'twilio_auth', 'resend', 'vapi'],
  monitoring: ['sentry'],
  media: ['cloudinary', 'pexels', 'midjourney'],
};

/**
 * Service key labels for display
 */
export const SERVICE_KEY_LABELS: Record<ServiceName, string> = {
  github: 'GitHub',
  supabase: 'Supabase',
  vercel: 'Vercel',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  stripe: 'Stripe',
  twilio_sid: 'Twilio SID',
  twilio_auth: 'Twilio Auth',
  resend: 'Resend',
  vapi: 'VAPI',
  sentry: 'Sentry',
  cloudinary: 'Cloudinary',
  pexels: 'Pexels',
  midjourney: 'Midjourney',
};

/**
 * Keys that can be used for auto-provisioning
 */
export const PROVISIONABLE_KEYS: ServiceName[] = ['github', 'supabase', 'vercel'];

type ServiceKeys = {
  [K in ServiceName]: string | null;
};

export type TrialStage = 'anonymous' | 'extended' | 'expired' | 'converted';

export interface TrialState {
  trialId: string;
  stage: TrialStage;
  deviceHash: string;
  expiresAt: string;  // ISO date
  startedAt: string;  // ISO date
  extendedAt?: string;  // ISO date
  githubUsername?: string;
  projectId?: string;
  projectName?: string;
}

interface ConfigSchema {
  apiKey: string | null;
  apiUrl: string;
  experienceLevel: ExperienceLevel;
  serviceKeys: ServiceKeys;
  lastKeySync: string | null;  // ISO date of last sync with server
  // Trial state (for zero-friction onboarding)
  trial: TrialState | null;
}

// Create default service keys object with all keys set to null
const defaultServiceKeys: ServiceKeys = Object.fromEntries(
  SERVICE_KEYS.map(key => [key, null])
) as ServiceKeys;

const config = new Conf<ConfigSchema>({
  projectName: 'codebakers',
  projectVersion: '1.8.0',
  defaults: {
    apiKey: null,
    apiUrl: 'https://codebakers.ai',
    experienceLevel: 'intermediate',
    serviceKeys: defaultServiceKeys,
    lastKeySync: null,
    trial: null,
  },
  // Migration to add new keys when upgrading from old version
  migrations: {
    '1.7.0': (store) => {
      const oldKeys = store.get('serviceKeys') as Partial<ServiceKeys>;
      const newKeys: ServiceKeys = { ...defaultServiceKeys };

      // Preserve existing keys
      for (const key of SERVICE_KEYS) {
        if (oldKeys && key in oldKeys && oldKeys[key]) {
          newKeys[key] = oldKeys[key] as string;
        }
      }

      store.set('serviceKeys', newKeys);
    },
    '1.8.0': (store) => {
      // Add trial field if not present
      if (!store.has('trial')) {
        store.set('trial', null);
      }
    },
  },
});

// ============================================================
// API Key Management
// ============================================================

export function getApiKey(): string | null {
  return config.get('apiKey');
}

export function setApiKey(key: string): void {
  config.set('apiKey', key);
}

export function clearApiKey(): void {
  config.delete('apiKey');
}

export function getApiUrl(): string {
  return config.get('apiUrl');
}

export function setApiUrl(url: string): void {
  config.set('apiUrl', url);
}

// ============================================================
// Experience Level
// ============================================================

export function getExperienceLevel(): ExperienceLevel {
  return config.get('experienceLevel');
}

export function setExperienceLevel(level: ExperienceLevel): void {
  config.set('experienceLevel', level);
}

// ============================================================
// Service API Keys
// ============================================================

export function getServiceKey(service: ServiceName): string | null {
  const keys = config.get('serviceKeys');
  return keys[service] ?? null;
}

export function setServiceKey(service: ServiceName, key: string): void {
  const keys = config.get('serviceKeys');
  keys[service] = key;
  config.set('serviceKeys', keys);
}

export function clearServiceKey(service: ServiceName): void {
  const keys = config.get('serviceKeys');
  keys[service] = null;
  config.set('serviceKeys', keys);
}

export function clearAllServiceKeys(): void {
  config.set('serviceKeys', { ...defaultServiceKeys });
  config.set('lastKeySync', null);
}

export function getAllServiceKeys(): ServiceKeys {
  return config.get('serviceKeys');
}

export function getConfiguredServiceKeys(): ServiceName[] {
  const keys = config.get('serviceKeys');
  return SERVICE_KEYS.filter(name => keys[name] !== null && keys[name] !== '');
}

export function getLastKeySync(): Date | null {
  const lastSync = config.get('lastKeySync');
  return lastSync ? new Date(lastSync) : null;
}

export function setLastKeySync(date: Date): void {
  config.set('lastKeySync', date.toISOString());
}

// ============================================================
// Bulk Key Operations
// ============================================================

export interface SyncResult {
  added: ServiceName[];
  updated: ServiceName[];
  unchanged: ServiceName[];
  total: number;
}

/**
 * Sync keys from server response to local storage
 */
export function syncServiceKeys(serverKeys: Partial<ServiceKeys>): SyncResult {
  const localKeys = config.get('serviceKeys');
  const result: SyncResult = {
    added: [],
    updated: [],
    unchanged: [],
    total: 0,
  };

  for (const keyName of SERVICE_KEYS) {
    const serverValue = serverKeys[keyName];
    const localValue = localKeys[keyName];

    if (serverValue) {
      result.total++;

      if (!localValue) {
        result.added.push(keyName);
        localKeys[keyName] = serverValue;
      } else if (localValue !== serverValue) {
        result.updated.push(keyName);
        localKeys[keyName] = serverValue;
      } else {
        result.unchanged.push(keyName);
      }
    }
  }

  config.set('serviceKeys', localKeys);
  config.set('lastKeySync', new Date().toISOString());

  return result;
}

// ============================================================
// Environment File Operations
// ============================================================

/**
 * Write service keys to a .env.local file
 */
export function writeKeysToEnvFile(projectPath: string, options?: {
  includeEmpty?: boolean;
  additionalVars?: Record<string, string>;
}): { written: number; path: string } {
  const envPath = join(projectPath, '.env.local');
  const keys = config.get('serviceKeys');
  const lines: string[] = [];

  // Header
  lines.push('# Service Keys - Generated by CodeBakers CLI');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Add additional vars first (like Supabase URL, etc.)
  if (options?.additionalVars) {
    lines.push('# Project Configuration');
    for (const [name, value] of Object.entries(options.additionalVars)) {
      lines.push(`${name}=${value}`);
    }
    lines.push('');
  }

  // Group keys by category
  for (const [category, keyNames] of Object.entries(SERVICE_KEY_CATEGORIES)) {
    const categoryLines: string[] = [];

    for (const keyName of keyNames) {
      const value = keys[keyName];
      const envVarName = ENV_VAR_NAMES[keyName];

      if (value) {
        categoryLines.push(`${envVarName}=${value}`);
      } else if (options?.includeEmpty) {
        categoryLines.push(`# ${envVarName}=`);
      }
    }

    if (categoryLines.length > 0) {
      lines.push(`# ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      lines.push(...categoryLines);
      lines.push('');
    }
  }

  // Read existing .env.local and preserve non-CodeBakers variables
  let existingContent = '';
  if (existsSync(envPath)) {
    existingContent = readFileSync(envPath, 'utf-8');

    // Extract lines that aren't CodeBakers-managed
    const existingLines = existingContent.split('\n');
    const preservedLines: string[] = [];
    let inCodeBakersSection = false;

    for (const line of existingLines) {
      if (line.includes('Generated by CodeBakers CLI')) {
        inCodeBakersSection = true;
        continue;
      }

      // Check if line is a CodeBakers-managed env var
      const isCodeBakersVar = Object.values(ENV_VAR_NAMES).some(
        envName => line.startsWith(`${envName}=`) || line.startsWith(`# ${envName}=`)
      );

      if (!isCodeBakersVar && !inCodeBakersSection && line.trim()) {
        preservedLines.push(line);
      }
    }

    // Add preserved lines at the end
    if (preservedLines.length > 0) {
      lines.push('# Existing Configuration');
      lines.push(...preservedLines);
    }
  }

  const content = lines.join('\n');
  writeFileSync(envPath, content);

  const written = Object.values(keys).filter(v => v !== null).length;
  return { written, path: envPath };
}

/**
 * Check if a key value appears valid (basic format check)
 */
export function validateKeyFormat(name: ServiceName, value: string): boolean {
  if (!value || value.length < 8) return false;

  const prefixes: Partial<Record<ServiceName, string[]>> = {
    github: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'],
    openai: ['sk-'],
    anthropic: ['sk-ant-'],
    stripe: ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_'],
    twilio_sid: ['AC'],
    resend: ['re_'],
    supabase: ['sbp_'],
  };

  const validPrefixes = prefixes[name];
  if (validPrefixes) {
    return validPrefixes.some(prefix => value.startsWith(prefix));
  }

  return true; // No specific format required
}

// ============================================================
// Config Path (for debugging)
// ============================================================

export function getConfigPath(): string {
  return config.path;
}

export function getConfigStore(): ConfigSchema {
  return config.store;
}

// ============================================================
// Trial State Management (Zero-Friction Onboarding)
// ============================================================

export function getTrialState(): TrialState | null {
  return config.get('trial');
}

export function setTrialState(trial: TrialState): void {
  config.set('trial', trial);
}

export function clearTrialState(): void {
  config.set('trial', null);
}

export function updateTrialState(updates: Partial<TrialState>): void {
  const current = config.get('trial');
  if (current) {
    config.set('trial', { ...current, ...updates });
  }
}

/**
 * Check if the current trial has expired
 */
export function isTrialExpired(): boolean {
  const trial = config.get('trial');
  if (!trial) return true;

  const expiresAt = new Date(trial.expiresAt);
  return new Date() > expiresAt;
}

/**
 * Get the number of days remaining in the trial
 */
export function getTrialDaysRemaining(): number {
  const trial = config.get('trial');
  if (!trial) return 0;

  const expiresAt = new Date(trial.expiresAt);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Check if user has any valid access (API key OR active trial)
 */
export function hasValidAccess(): boolean {
  // Paid users always have access
  const apiKey = config.get('apiKey');
  if (apiKey) return true;

  // Check trial
  const trial = config.get('trial');
  if (!trial) return false;

  return !isTrialExpired();
}

/**
 * Get authentication mode: 'apiKey', 'trial', or 'none'
 */
export function getAuthMode(): 'apiKey' | 'trial' | 'none' {
  const apiKey = config.get('apiKey');
  if (apiKey) return 'apiKey';

  const trial = config.get('trial');
  if (trial && !isTrialExpired()) return 'trial';

  return 'none';
}
