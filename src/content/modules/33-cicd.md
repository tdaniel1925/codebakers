# 33-CICD.md - CI/CD & Deployment Patterns

Production-ready patterns for GitHub Actions, Vercel, Netlify, and Docker deployments.

---

## DECISION GUIDE

Before setting up deployment, ask:

| Question | Options | Impact |
|----------|---------|--------|
| **Hosting Platform?** | Vercel, Netlify, Railway, Fly.io, Docker | Determines config files |
| **Need Preview Deploys?** | Yes/No | Branch deployments |
| **Database Migrations?** | Auto on deploy / Manual | CI pipeline complexity |
| **Environment Count?** | Dev, Staging, Prod | Env var management |

---

## QUICK SETUP COMMANDS

| Command | What It Does |
|---------|--------------|
| `/deploy vercel` | Generate Vercel config + GitHub Action |
| `/deploy netlify` | Generate Netlify config + redirects |
| `/deploy github` | Generate full CI/CD pipeline |
| `/deploy docker` | Generate Dockerfile + compose |

---

## GITHUB ACTIONS

### Complete CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # ============================================
  # QUALITY CHECKS (runs on every PR)
  # ============================================
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npx prettier --check .

  # ============================================
  # UNIT & INTEGRATION TESTS
  # ============================================
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  # ============================================
  # E2E TESTS (Playwright)
  # ============================================
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build application
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Run E2E tests
        run: npm test
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  # ============================================
  # BUILD CHECK
  # ============================================
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test, e2e]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  # ============================================
  # DATABASE MIGRATIONS (on main only)
  # ============================================
  migrate:
    name: Database Migrations
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx drizzle-kit migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}

  # ============================================
  # DEPLOY TO PRODUCTION (Vercel)
  # ============================================
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, migrate]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### PR Preview Workflow

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel (Preview)
        uses: amondnet/vercel-action@v25
        id: vercel-deploy
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Comment Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview deployed to: ${{ steps.vercel-deploy.outputs.preview-url }}`
            })
```

---

## VERCEL

### vercel.json Configuration

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "regions": ["iad1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/api/health",
      "destination": "/api/health"
    }
  ]
}
```

### Environment Variables Setup

```bash
# Required for Vercel deployment
# Set these in Vercel Dashboard > Project > Settings > Environment Variables

# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Stripe (Production keys)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optional
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Vercel CLI Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod

# Set environment variables
vercel env add DATABASE_URL
vercel env add STRIPE_SECRET_KEY
```

---

## NETLIFY

### netlify.toml Configuration

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  NPM_FLAGS = "--legacy-peer-deps"

# Next.js plugin for Netlify
[[plugins]]
  package = "@netlify/plugin-nextjs"

# Headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"

# Redirects
[[redirects]]
  from = "/home"
  to = "/"
  status = 301

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

# Branch deploys
[context.production]
  command = "npm run build"

[context.deploy-preview]
  command = "npm run build"

[context.branch-deploy]
  command = "npm run build"
```

### Netlify Functions

```typescript
// netlify/functions/api.ts
import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Netlify Functions' }),
  };
};
```

---

## DOCKER

### Dockerfile (Production)

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build
ARG DATABASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        DATABASE_URL: ${DATABASE_URL}
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### .dockerignore

```
node_modules
.next
.git
.gitignore
*.md
.env*
!.env.example
Dockerfile*
docker-compose*
.dockerignore
coverage
.nyc_output
playwright-report
test-results
```

---

## ENVIRONMENT MANAGEMENT

### Environment Variable Checklist

```typescript
// lib/env-check.ts
const requiredEnvVars = {
  // Always required
  required: [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],

  // Required in production
  production: [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ],

  // Optional but recommended
  recommended: [
    'SENTRY_DSN',
    'NEXT_PUBLIC_APP_URL',
  ],
};

export function checkEnvVars() {
  const missing: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  for (const key of requiredEnvVars.required) {
    if (!process.env[key]) missing.push(key);
  }

  if (isProduction) {
    for (const key of requiredEnvVars.production) {
      if (!process.env[key]) missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    if (isProduction) process.exit(1);
  }

  return missing.length === 0;
}
```

### Secret Management

```yaml
# .github/workflows/secrets-check.yml
name: Secrets Audit

on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for hardcoded secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          extra_args: --only-verified
```

---

## PRE-DEPLOYMENT CHECKLIST

When user runs `/deploy`, show this checklist:

```
🚀 Pre-Deployment Checklist

**Code Quality:**
[ ] TypeScript compiles without errors
[ ] All tests passing
[ ] No console.log in production code
[ ] Error handling in place

**Security:**
[ ] No hardcoded secrets
[ ] Environment variables set
[ ] Security headers configured
[ ] Rate limiting enabled

**Database:**
[ ] Migrations ready
[ ] Backup strategy in place
[ ] Connection pooling configured

**Monitoring:**
[ ] Error tracking (Sentry) configured
[ ] Logging set up
[ ] Health check endpoint exists

**Performance:**
[ ] Images optimized
[ ] Bundle size acceptable
[ ] Caching configured

Ready to deploy?
```

---

## HEALTH CHECK ENDPOINT

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'unknown',
      memory: 'unknown',
    },
  };

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
  }

  // Check memory
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  checks.checks.memory = heapUsedMB < 500 ? 'healthy' : 'warning';

  const statusCode = checks.status === 'healthy' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
```

---

## ONE-COMMAND DEPLOYMENT

### Vercel (Recommended for Next.js)

```bash
# One command to deploy
npx vercel --prod
```

### Full Setup Script

```bash
#!/bin/bash
# scripts/setup-deployment.sh

echo "🚀 Setting up deployment..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm i -g vercel
fi

# Link project
echo "Linking to Vercel..."
vercel link

# Set up environment variables
echo "Setting up environment variables..."
echo "Please enter your DATABASE_URL:"
read -s DATABASE_URL
vercel env add DATABASE_URL production <<< "$DATABASE_URL"

echo "Please enter your NEXT_PUBLIC_SUPABASE_URL:"
read SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "$SUPABASE_URL"

echo "Please enter your NEXT_PUBLIC_SUPABASE_ANON_KEY:"
read SUPABASE_KEY
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "$SUPABASE_KEY"

echo "✅ Deployment setup complete!"
echo "Run 'vercel --prod' to deploy"
```

---

## ROLLBACK STRATEGY

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      deployment_id:
        description: 'Vercel deployment ID to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback deployment
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.VERCEL_TOKEN }}" \
            "https://api.vercel.com/v13/deployments/${{ inputs.deployment_id }}/rollback"
```

---

## MONITORING INTEGRATION

### Sentry Setup

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
});
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
});
```

---

## SUMMARY

| Platform | Best For | Setup Time |
|----------|----------|------------|
| **Vercel** | Next.js apps, fastest setup | 5 minutes |
| **Netlify** | Static sites, JAMstack | 10 minutes |
| **Railway** | Full-stack with DB | 15 minutes |
| **Docker** | Custom infra, self-hosted | 30 minutes |

**Recommendation:** Use Vercel for Next.js apps - it's optimized for the framework and requires minimal configuration.
