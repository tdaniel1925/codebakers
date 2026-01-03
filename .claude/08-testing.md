# TESTING & CI/CD
# Module: 08-testing.md
# Load with: 00-core.md

---

# PART 19: DEPLOYMENT & CI/CD

## 🚀 VERCEL DEPLOYMENT

### vercel.json Configuration

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    },
    "app/api/webhooks/**/*.ts": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/daily-cleanup",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
      ]
    }
  ]
}
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    name: Lint
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
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run TypeScript check
        run: npm run type-check

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
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
        run: npx playwright install chromium
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, test]
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
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-comment: true

  deploy-production:
    name: Deploy Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Database Migrations Workflow

```yaml
# .github/workflows/migrate.yml
name: Database Migrations

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to run migrations'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  migrate:
    name: Run Migrations
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Verify migrations
        run: npm run db:check
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---


---

# PART 37: ANALYTICS INTEGRATION

## PostHog Setup

```typescript
// lib/posthog.ts
import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false, // We'll manually capture
      capture_pageleave: true,
    });
  }
}

export { posthog };
```

```typescript
// components/providers/posthog-provider.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { posthog, initPostHog } from '@/lib/posthog';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    initPostHog();
  }, []);
  
  // Track page views
  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams]);
  
  return <>{children}</>;
}
```

## Event Tracking Patterns

```typescript
// lib/analytics.ts
import { posthog } from '@/lib/posthog';

export const analytics = {
  // User events
  identify(userId: string, traits?: Record<string, any>) {
    posthog.identify(userId, traits);
  },
  
  reset() {
    posthog.reset();
  },
  
  // Feature usage
  trackFeatureUsed(feature: string, properties?: Record<string, any>) {
    posthog.capture('feature_used', { feature, ...properties });
  },
  
  // Conversion events
  trackSignup(method: 'email' | 'google' | 'github') {
    posthog.capture('user_signed_up', { method });
  },
  
  trackSubscription(plan: string, interval: 'month' | 'year') {
    posthog.capture('subscription_started', { plan, interval });
  },
  
  trackUpgrade(fromPlan: string, toPlan: string) {
    posthog.capture('subscription_upgraded', { fromPlan, toPlan });
  },
  
  trackChurn(plan: string, reason?: string) {
    posthog.capture('subscription_cancelled', { plan, reason });
  },
  
  // Engagement
  trackButtonClick(button: string, page: string) {
    posthog.capture('button_clicked', { button, page });
  },
  
  trackSearch(query: string, resultsCount: number) {
    posthog.capture('search_performed', { query, resultsCount });
  },
  
  trackError(error: string, context?: Record<string, any>) {
    posthog.capture('error_occurred', { error, ...context });
  },
};

// Usage
analytics.identify(user.id, { email: user.email, plan: user.plan });
analytics.trackFeatureUsed('export_csv', { rowCount: 150 });
analytics.trackSubscription('pro', 'month');
```

---


---

# PART 38: ERROR MONITORING (SENTRY)

## Setup

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Don't send in development
  enabled: process.env.NODE_ENV === 'production',
  
  // Filter out noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection',
  ],
});
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
});
```

## Error Boundary

```typescript
// components/error-boundary.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">
        We've been notified and are working on it.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

## Manual Error Capture

```typescript
// Capture with context
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'payment',
      userId: user.id,
    },
    extra: {
      orderId: order.id,
      amount: order.amount,
    },
  });
  throw error;
}

// Capture message
Sentry.captureMessage('Payment retry needed', {
  level: 'warning',
  tags: { paymentId: payment.id },
});

// Set user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  plan: user.plan,
});
```

---


---

# PART 66: TESTING PATTERNS

## Test Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
```

## Unit Test Examples

```typescript
// lib/money.test.ts
import { describe, it, expect } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  describe('toCents', () => {
    it('converts dollars to cents', () => {
      expect(Money.toCents(19.99)).toBe(1999);
      expect(Money.toCents(100)).toBe(10000);
      expect(Money.toCents(0.01)).toBe(1);
    });
    
    it('handles floating point correctly', () => {
      // Famous JS floating point issue: 0.1 + 0.2 !== 0.3
      expect(Money.toCents(0.1 + 0.2)).toBe(30);
    });
  });
  
  describe('format', () => {
    it('formats USD correctly', () => {
      expect(Money.format(1999)).toBe('$19.99');
      expect(Money.format(10000)).toBe('$100.00');
    });
    
    it('formats other currencies', () => {
      expect(Money.format(1999, 'EUR', 'de-DE')).toContain('€');
    });
  });
  
  describe('allocate', () => {
    it('splits amount according to ratios', () => {
      expect(Money.allocate(10000, [70, 30])).toEqual([7000, 3000]);
    });
    
    it('handles remainders', () => {
      // 100 cents split 3 ways: 33 + 33 + 34
      expect(Money.allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    });
  });
});
```

## Integration Test (API)

```typescript
// app/api/users/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { db } from '@/db';

describe('GET /api/users', () => {
  beforeEach(async () => {
    // Clean up before each test
    await db.delete(users);
  });
  
  it('returns empty array when no users', async () => {
    const req = new Request('http://localhost/api/users');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
  
  it('returns users', async () => {
    // Setup
    await db.insert(users).values({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
    });
    
    const req = new Request('http://localhost/api/users');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe('test@test.com');
  });
});

describe('POST /api/users', () => {
  it('creates user with valid data', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@test.com',
        name: 'New User',
        password: 'password123',
      }),
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(201);
    expect(data.email).toBe('new@test.com');
    expect(data.password).toBeUndefined(); // Should not return password
  });
  
  it('returns 400 for invalid email', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        name: 'Test',
        password: 'password123',
      }),
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(400);
  });
});
```

## Component Test

```typescript
// components/button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    
    expect(screen.getByText('Click me')).toBeDisabled();
  });
  
  it('shows loading state', () => {
    render(<Button loading>Submit</Button>);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

---


---

# PART 67: CI/CD PIPELINE

## GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint:
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
      
      - name: Run linter
        run: npm run lint
  
  typecheck:
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
      
      - name: Run type check
        run: npm run typecheck
  
  test:
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
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
  
  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
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
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}
  
  deploy:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main'
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

## Database Migration in CI

```yaml
# .github/workflows/deploy.yml
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npx drizzle-kit push:pg
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

