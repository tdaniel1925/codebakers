/**
 * CENTRALIZED CONSTANTS
 *
 * Single source of truth for all business values.
 * NEVER hardcode these values anywhere else in the codebase.
 *
 * ESLint rules enforce usage of these constants.
 * Changing a value here automatically updates it everywhere.
 */

// =============================================================================
// PRICING
// =============================================================================

export const PRICING = {
  PRO: {
    MONTHLY: 49,
    YEARLY: 490, // ~2 months free
    SEATS: 1,
  },
  TEAM: {
    MONTHLY: 149,
    YEARLY: 1490,
    SEATS: 5,
  },
  AGENCY: {
    MONTHLY: 349,
    YEARLY: 3490,
    SEATS: -1, // -1 = unlimited
  },
  ENTERPRISE: {
    MONTHLY: null, // Custom pricing
    YEARLY: null,
    SEATS: -1,
  },
} as const;

export const PLAN_NAMES = {
  PRO: 'pro',
  TEAM: 'team',
  AGENCY: 'agency',
  ENTERPRISE: 'enterprise',
} as const;

// =============================================================================
// TRIAL
// =============================================================================

export const TRIAL = {
  ANONYMOUS_DAYS: 7, // Note: "Anonymous" is legacy naming - GitHub OAuth is now required
  EXTENDED_DAYS: 7, // Legacy - extension no longer available
  TOTAL_DAYS: 14, // Legacy - now only 7 days with GitHub
  EXPIRING_SOON_THRESHOLD: 2, // days remaining to show warning
} as const;

export const TRIAL_STAGES = {
  ANONYMOUS: 'anonymous',
  EXTENDED: 'extended',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
} as const;

// =============================================================================
// MODULES / PATTERNS
// =============================================================================

export const MODULES = {
  COUNT: 40,
  RANGE: { START: 0, END: 39 },
} as const;

// Module names for reference
export const MODULE_NAMES = [
  '00-core',
  '01-database',
  '02-auth',
  '03-api',
  '04-frontend',
  '05-payments',
  '06-integrations',
  '07-performance',
  '08-testing',
  '09-design',
  '10-generators',
  '11-realtime',
  '12-saas',
  '13-mobile',
  '14-ai',
  '15-research',
  '16-planning',
  '17-marketing',
  '18-launch',
  '19-audit',
  '20-operations',
  '21-experts-core',
  '22-experts-health',
  '23-experts-finance',
  '24-experts-legal',
  '25-experts-industry',
  '26-analytics',
  '27-search',
  '28-email-design',
  '29-data-viz',
  '30-motion',
  '31-iconography',
  '32-print',
  '33-design-clone',
  '34-reserved',
  '35-reserved',
  '36-reserved',
  '37-reserved',
  '38-reserved',
  '39-reserved',
] as const;

// =============================================================================
// API KEYS
// =============================================================================

export const API_KEYS = {
  PREFIX: 'cb_',
  LENGTH: 32, // characters after prefix
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 60,
    REQUESTS_PER_HOUR: 1000,
  },
} as const;

// =============================================================================
// PRODUCT INFO
// =============================================================================

export const PRODUCT = {
  NAME: 'CodeBakers',
  TAGLINE: 'AI writes correct code',
  SUPPORT_EMAIL: 'support@codebakers.ai',
  WEBSITE: 'https://codebakers.ai',
  CLI_COMMAND: 'npx @codebakers/cli go',
  CLI_EXTEND_COMMAND: 'codebakers extend',
  CLI_BILLING_COMMAND: 'codebakers billing',
} as const;

// =============================================================================
// INTEGRATIONS
// =============================================================================

export const INTEGRATIONS = {
  SUPPORTED_IDES: ['Cursor', 'Claude Code'] as const,
  PAYMENT_PROVIDERS: ['stripe', 'paypal', 'square'] as const,
  OAUTH_PROVIDERS: ['github'] as const,
} as const;

// =============================================================================
// UI MESSAGES
// =============================================================================

export const MESSAGES = {
  TRIAL: {
    ACTIVE: (days: number) =>
      `${days} day${days !== 1 ? 's' : ''} remaining in your free trial`,
    // Legacy - kept for backwards compatibility
    ANONYMOUS_ACTIVE: (days: number) =>
      `${days} day${days !== 1 ? 's' : ''} remaining in your free trial`,
    EXTENDED_ACTIVE: (days: number) =>
      `${days} day${days !== 1 ? 's' : ''} remaining`,
    EXTEND_CTA: 'Connect GitHub to extend for 7 more days free', // Legacy
    EXPIRED_CAN_EXTEND: 'Trial expired - Connect GitHub for 7 more days free!', // Legacy
    EXPIRED_FINAL: 'Your trial has ended',
    UPGRADE_CTA: `Upgrade to Pro ($${PRICING.PRO.MONTHLY}/mo) for unlimited access`,
  },
  SUBSCRIPTION: {
    ACTIVE: 'Unlimited projects & all 40 modules',
    INACTIVE: 'No active subscription - upgrade to access all 40 modules',
    BETA: 'Admin-granted beta access',
  },
  ERRORS: {
    TRIAL_EXPIRED: 'Run `codebakers extend` or `codebakers billing`',
    TRIAL_NOT_AVAILABLE: 'Upgrade at codebakers.ai/billing',
    API_KEY_INVALID: 'Invalid API key. Generate a new one at codebakers.ai/account',
    RATE_LIMITED: 'Too many requests. Please slow down.',
  },
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURES = {
  TRIAL_SYSTEM_ENABLED: true,
  GITHUB_EXTENSION_ENABLED: false, // Extension no longer needed - GitHub required from start
  ANONYMOUS_TRIAL_ENABLED: false, // GitHub OAuth now required to start trial
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PlanName = typeof PLAN_NAMES[keyof typeof PLAN_NAMES];
export type TrialStage = typeof TRIAL_STAGES[keyof typeof TRIAL_STAGES];
export type PaymentProvider = typeof INTEGRATIONS.PAYMENT_PROVIDERS[number];
export type OAuthProvider = typeof INTEGRATIONS.OAUTH_PROVIDERS[number];
export type SupportedIDE = typeof INTEGRATIONS.SUPPORTED_IDES[number];
