/**
 * SERVICE KEYS CONTRACT
 *
 * This is the SINGLE SOURCE OF TRUTH for service key definitions.
 * All systems (Dashboard, CLI, API) must use these definitions.
 *
 * When adding a new service key:
 * 1. Add to SERVICE_KEYS array
 * 2. Add to ServiceKeyConfig
 * 3. Update ENV_VAR_NAMES
 * 4. Run contract tests to verify all systems updated
 */

/**
 * Canonical list of ALL supported service keys.
 * Order matters - this is display order in dashboard.
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

export type ServiceKeyName = typeof SERVICE_KEYS[number];

/**
 * Configuration for each service key
 */
export interface ServiceKeyConfig {
  name: ServiceKeyName;
  label: string;
  description: string;
  placeholder: string;
  helpUrl: string;
  envVarName: string;
  category: 'infrastructure' | 'ai' | 'payments' | 'communication' | 'monitoring' | 'media';
  provisionable: boolean;  // Can CLI auto-provision this service?
  cliSync: boolean;        // Should this sync to CLI local storage?
  required: boolean;       // Required for scaffold to work?
}

/**
 * Full configuration for all service keys
 */
export const SERVICE_KEY_CONFIGS: Record<ServiceKeyName, ServiceKeyConfig> = {
  github: {
    name: 'github',
    label: 'GitHub',
    description: 'Personal Access Token for repository operations',
    placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://github.com/settings/tokens',
    envVarName: 'GITHUB_TOKEN',
    category: 'infrastructure',
    provisionable: true,
    cliSync: true,
    required: false,
  },
  supabase: {
    name: 'supabase',
    label: 'Supabase',
    description: 'Access token for project creation',
    placeholder: 'sbp_xxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    envVarName: 'SUPABASE_ACCESS_TOKEN',
    category: 'infrastructure',
    provisionable: true,
    cliSync: true,
    required: false,
  },
  vercel: {
    name: 'vercel',
    label: 'Vercel',
    description: 'Access token for deployment',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://vercel.com/account/tokens',
    envVarName: 'VERCEL_TOKEN',
    category: 'infrastructure',
    provisionable: true,
    cliSync: true,
    required: false,
  },
  openai: {
    name: 'openai',
    label: 'OpenAI',
    description: 'API key for GPT models',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://platform.openai.com/api-keys',
    envVarName: 'OPENAI_API_KEY',
    category: 'ai',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  anthropic: {
    name: 'anthropic',
    label: 'Anthropic',
    description: 'API key for Claude models',
    placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    envVarName: 'ANTHROPIC_API_KEY',
    category: 'ai',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  stripe: {
    name: 'stripe',
    label: 'Stripe',
    description: 'Secret key for payments',
    placeholder: 'sk_live_xxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://dashboard.stripe.com/apikeys',
    envVarName: 'STRIPE_SECRET_KEY',
    category: 'payments',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  twilio_sid: {
    name: 'twilio_sid',
    label: 'Twilio Account SID',
    description: 'Account SID for SMS/Voice',
    placeholder: 'ACxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://console.twilio.com',
    envVarName: 'TWILIO_ACCOUNT_SID',
    category: 'communication',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  twilio_auth: {
    name: 'twilio_auth',
    label: 'Twilio Auth Token',
    description: 'Auth token for SMS/Voice',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://console.twilio.com',
    envVarName: 'TWILIO_AUTH_TOKEN',
    category: 'communication',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  resend: {
    name: 'resend',
    label: 'Resend',
    description: 'API key for transactional email',
    placeholder: 're_xxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://resend.com/api-keys',
    envVarName: 'RESEND_API_KEY',
    category: 'communication',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  vapi: {
    name: 'vapi',
    label: 'VAPI',
    description: 'API key for voice AI',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://dashboard.vapi.ai',
    envVarName: 'VAPI_API_KEY',
    category: 'communication',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  sentry: {
    name: 'sentry',
    label: 'Sentry',
    description: 'DSN for error tracking',
    placeholder: 'https://xxxx@sentry.io/xxxx',
    helpUrl: 'https://sentry.io/settings/projects/',
    envVarName: 'SENTRY_DSN',
    category: 'monitoring',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  cloudinary: {
    name: 'cloudinary',
    label: 'Cloudinary',
    description: 'API secret for media management',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://console.cloudinary.com/settings/api-keys',
    envVarName: 'CLOUDINARY_API_SECRET',
    category: 'media',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  pexels: {
    name: 'pexels',
    label: 'Pexels',
    description: 'API key for stock photos',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://www.pexels.com/api/',
    envVarName: 'PEXELS_API_KEY',
    category: 'media',
    provisionable: false,
    cliSync: true,
    required: false,
  },
  midjourney: {
    name: 'midjourney',
    label: 'Midjourney',
    description: 'API key for AI image generation',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://www.midjourney.com',
    envVarName: 'MIDJOURNEY_API_KEY',
    category: 'media',
    provisionable: false,
    cliSync: true,
    required: false,
  },
};

/**
 * Map of service key names to environment variable names
 */
export const ENV_VAR_NAMES: Record<ServiceKeyName, string> = Object.fromEntries(
  SERVICE_KEYS.map(key => [key, SERVICE_KEY_CONFIGS[key].envVarName])
) as Record<ServiceKeyName, string>;

/**
 * Get keys by category
 */
export function getKeysByCategory(category: ServiceKeyConfig['category']): ServiceKeyName[] {
  return SERVICE_KEYS.filter(key => SERVICE_KEY_CONFIGS[key].category === category);
}

/**
 * Get provisionable keys (for CLI auto-provisioning)
 */
export function getProvisionableKeys(): ServiceKeyName[] {
  return SERVICE_KEYS.filter(key => SERVICE_KEY_CONFIGS[key].provisionable);
}

/**
 * Get CLI-syncable keys
 */
export function getCLISyncKeys(): ServiceKeyName[] {
  return SERVICE_KEYS.filter(key => SERVICE_KEY_CONFIGS[key].cliSync);
}

/**
 * Type for API response containing all service keys
 */
export type ServiceKeysResponse = {
  [K in ServiceKeyName]?: string | null;
};

/**
 * Type for masked keys display (dashboard)
 */
export type ServiceKeysMasked = {
  [K in ServiceKeyName]?: {
    configured: boolean;
    masked: string | null;
  };
};

/**
 * Validate a service key value format (basic validation)
 */
export function validateKeyFormat(name: ServiceKeyName, value: string): boolean {
  if (!value || value.length < 8) return false;

  const prefixes: Partial<Record<ServiceKeyName, string[]>> = {
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
