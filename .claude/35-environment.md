# Environment & Secrets Management Patterns

> Load this module when: Setting up projects, configuring APIs, handling secrets, deploying

---

## Environment File Structure

### Required Files

```
project/
├── .env.example          # Template with all vars (committed)
├── .env.local            # Local development secrets (gitignored)
├── .env.test             # Test environment (gitignored)
└── .env.production.local # Production secrets (gitignored)
```

### .gitignore Requirements

```gitignore
# Environment files with secrets
.env
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local

# Never commit these
*.pem
*.key
*_rsa
credentials.json
service-account.json
```

---

## Environment Variable Naming

### Prefixes by Category

```bash
# Database
DATABASE_URL=
DB_HOST=
DB_PASSWORD=

# Authentication
AUTH_SECRET=
NEXTAUTH_SECRET=
JWT_SECRET=

# Third-party APIs (use service name)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Feature flags
FEATURE_NEW_DASHBOARD=
FEATURE_BETA_API=

# App configuration
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
```

### Naming Rules

1. **SCREAMING_SNAKE_CASE** always
2. **Prefix with service name** for third-party keys
3. **NEXT_PUBLIC_** prefix for client-exposed vars (Next.js)
4. **Never put secrets in NEXT_PUBLIC_ vars**

---

## Validation Pattern

### Zod Schema for Environment

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),

  // Optional with defaults
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Conditional (required in production)
  STRIPE_SECRET_KEY: z.string().optional().refine(
    (val) => process.env.NODE_ENV !== 'production' || !!val,
    'STRIPE_SECRET_KEY is required in production'
  ),

  // Public vars (safe to expose)
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

// Validate on startup
export const env = envSchema.parse(process.env);

// Type-safe access
export type Env = z.infer<typeof envSchema>;
```

### Startup Validation

```typescript
// src/lib/validate-env.ts
export function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'AUTH_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:\n');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.error('\n📋 Copy .env.example to .env.local and fill in values\n');
    process.exit(1);
  }
}
```

---

## Secret Generation

### Secure Random Secrets

```typescript
// Generate AUTH_SECRET
import crypto from 'crypto';

// 32-byte secret (256 bits)
const secret = crypto.randomBytes(32).toString('base64');
console.log(`AUTH_SECRET=${secret}`);

// URL-safe secret
const urlSafeSecret = crypto.randomBytes(32).toString('base64url');
```

### CLI Helper

```bash
# Generate secure secret
openssl rand -base64 32

# Generate URL-safe secret
openssl rand -base64 32 | tr '+/' '-_'
```

---

## Per-Environment Configuration

### Development vs Production

```typescript
// src/lib/config.ts
export const config = {
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // URLs
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',

  // Features
  features: {
    analytics: process.env.NODE_ENV === 'production',
    debugMode: process.env.NODE_ENV === 'development',
    mockApis: process.env.USE_MOCK_APIS === 'true',
  },

  // Rate limits (stricter in production)
  rateLimit: {
    windowMs: process.env.NODE_ENV === 'production' ? 60000 : 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  },
};
```

---

## Service Key Categories

### Infrastructure Keys (Auto-Provisioning)

```bash
# Can be auto-created with codebakers scaffold
GITHUB_TOKEN=           # GitHub personal access token
SUPABASE_ACCESS_TOKEN=  # Supabase management API
VERCEL_TOKEN=           # Vercel deployment token
```

### AI Service Keys

```bash
OPENAI_API_KEY=         # OpenAI GPT models
ANTHROPIC_API_KEY=      # Claude models
```

### Payment Keys

```bash
STRIPE_SECRET_KEY=      # Stripe backend
STRIPE_PUBLISHABLE_KEY= # Stripe frontend (NEXT_PUBLIC_)
STRIPE_WEBHOOK_SECRET=  # Stripe webhooks
```

### Communication Keys

```bash
TWILIO_ACCOUNT_SID=     # Twilio account
TWILIO_AUTH_TOKEN=      # Twilio auth
RESEND_API_KEY=         # Resend email
VAPI_API_KEY=           # VAPI voice
```

### Monitoring Keys

```bash
SENTRY_DSN=             # Sentry error tracking
SENTRY_AUTH_TOKEN=      # Sentry releases
```

### Media Keys

```bash
CLOUDINARY_URL=         # Cloudinary media
PEXELS_API_KEY=         # Pexels stock images
```

---

## .env.example Template

```bash
# ===========================================
# Project Configuration
# ===========================================
# Copy this file to .env.local and fill in values
# NEVER commit .env.local to git

# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===========================================
# Database (Required)
# ===========================================
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Supabase (if using)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ===========================================
# Authentication (Required)
# ===========================================
# Generate with: openssl rand -base64 32
AUTH_SECRET=

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ===========================================
# Payments (Required for billing)
# ===========================================
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# ===========================================
# AI Services (Optional)
# ===========================================
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# ===========================================
# Email (Required for auth emails)
# ===========================================
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# ===========================================
# Monitoring (Recommended for production)
# ===========================================
SENTRY_DSN=

# ===========================================
# Infrastructure (For auto-provisioning)
# ===========================================
# Only needed if using `codebakers scaffold` auto-provision
GITHUB_TOKEN=
SUPABASE_ACCESS_TOKEN=
VERCEL_TOKEN=
```

---

## Loading Environment Variables

### Next.js (Automatic)

```typescript
// Next.js loads .env.local automatically
// Access via process.env.VAR_NAME
```

### Node.js Scripts

```typescript
// scripts/migrate.ts
import 'dotenv/config'; // Load .env.local

// Now process.env is populated
```

### Testing

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      AUTH_SECRET: 'test-secret-at-least-32-characters-long',
    },
  },
});
```

---

## Common Mistakes to Avoid

### 1. Committing Secrets

```bash
# WRONG - committed real values
DATABASE_URL=postgresql://admin:realpassword@prod.db.com/prod

# RIGHT - use .env.example with placeholders
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 2. Using Secrets in Client Code

```typescript
// WRONG - exposed to browser
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// RIGHT - only use in API routes/server components
// app/api/checkout/route.ts (server-side only)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

### 3. Hardcoding Values

```typescript
// WRONG
const apiUrl = 'https://api.production.com';

// RIGHT
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

### 4. Missing Validation

```typescript
// WRONG - crashes cryptically later
const dbUrl = process.env.DATABASE_URL;
// ... code runs, then fails when DB connection attempted

// RIGHT - fail fast with clear message
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
```

### 5. Different Var Names Across Environments

```bash
# WRONG - confusing
# Development: DB_URL
# Production: DATABASE_CONNECTION_STRING

# RIGHT - same name everywhere
DATABASE_URL=...
```

---

## Deployment Checklist

### Before Deploying

- [ ] All required vars set in deployment platform
- [ ] Secrets rotated from development values
- [ ] No NEXT_PUBLIC_ vars contain secrets
- [ ] Webhook URLs updated to production domain
- [ ] OAuth redirect URLs include production domain
- [ ] Rate limits appropriate for production
- [ ] Error tracking (Sentry) DSN configured

### Vercel Environment Setup

```bash
# Set production vars
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production

# Set preview vars (for PR deployments)
vercel env add DATABASE_URL preview

# Pull vars to local
vercel env pull .env.local
```

### Supabase Environment

```bash
# Get connection string from Supabase dashboard
# Settings > Database > Connection string > URI

# Use connection pooler for serverless
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## Secret Rotation

### When to Rotate

- Developer leaves team
- Secret accidentally committed
- Periodic rotation (quarterly recommended)
- Security incident

### Rotation Process

1. Generate new secret
2. Update in deployment platform
3. Deploy with new secret
4. Verify app works
5. Revoke old secret
6. Update local .env.local files

```bash
# Generate new AUTH_SECRET
NEW_SECRET=$(openssl rand -base64 32)

# Update in Vercel
vercel env rm AUTH_SECRET production
vercel env add AUTH_SECRET production <<< "$NEW_SECRET"

# Redeploy
vercel --prod
```

---

## Debugging Environment Issues

### Check What's Loaded

```typescript
// Temporarily log (remove before commit!)
console.log('Loaded env vars:', {
  hasDbUrl: !!process.env.DATABASE_URL,
  hasAuthSecret: !!process.env.AUTH_SECRET,
  nodeEnv: process.env.NODE_ENV,
});
```

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `undefined` value | Var not in .env.local | Add to .env.local |
| Works locally, fails deployed | Not set in Vercel/platform | Add via platform UI |
| NEXT_PUBLIC_ undefined on client | Need rebuild after adding | Restart dev server |
| Different value than expected | Multiple .env files | Check load order |

### Load Order (Next.js)

1. `.env.$(NODE_ENV).local` (highest priority)
2. `.env.local` (not loaded in test)
3. `.env.$(NODE_ENV)`
4. `.env` (lowest priority)
