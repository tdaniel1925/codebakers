import { z } from 'zod';

/**
 * Server-side environment variables schema
 * Validates required env vars at build/runtime
 */
const serverEnvSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Admin (optional - will use default if not set)
  ADMIN_EMAIL: z.string().email().optional(),

  // Stripe (optional during beta)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_TEAM_PRICE_ID: z.string().optional(),
  STRIPE_AGENCY_PRICE_ID: z.string().optional(),

  // Anthropic (optional)
  ANTHROPIC_API_KEY: z.string().optional(),
});

/**
 * Client-side environment variables schema
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validate and return server environment variables
 * Call this early in the app lifecycle to fail fast
 */
export function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid server environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Missing or invalid environment variables. Check server logs.');
  }

  return result.data;
}

/**
 * Validate client environment variables
 */
export function validateClientEnv(): ClientEnv {
  const clientEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const result = clientEnvSchema.safeParse(clientEnv);

  if (!result.success) {
    console.error('Invalid client environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Missing or invalid client environment variables.');
  }

  return result.data;
}

// Validate on module load (will fail fast if env is wrong)
let serverEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!serverEnv) {
    serverEnv = validateServerEnv();
  }
  return serverEnv;
}
