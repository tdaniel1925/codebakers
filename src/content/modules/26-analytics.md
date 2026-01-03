# Analytics Module
# Product Analytics, Event Tracking, User Behavior, Dashboards

---

## Provider Setup

### PostHog (Recommended - Self-hostable)

```typescript
// lib/analytics/posthog.ts
import posthog from 'posthog-js';

// Client-side initialization
export function initPostHog() {
  if (typeof window !== 'undefined' && !posthog.__loaded) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug();
        }
      },
      capture_pageview: false, // We'll handle manually for SPAs
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-mask]',
      },
    });
  }
  return posthog;
}

// Server-side client
import { PostHog } from 'posthog-node';

export const posthogServer = new PostHog(
  process.env.POSTHOG_API_KEY!,
  { host: process.env.POSTHOG_HOST || 'https://app.posthog.com' }
);
```

### Mixpanel

```typescript
// lib/analytics/mixpanel.ts
import mixpanel from 'mixpanel-browser';

export function initMixpanel() {
  mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN!, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage',
    ignore_dnt: false,
  });
  return mixpanel;
}

// Server-side
import Mixpanel from 'mixpanel';

export const mixpanelServer = Mixpanel.init(process.env.MIXPANEL_TOKEN!, {
  protocol: 'https',
});
```

### Amplitude

```typescript
// lib/analytics/amplitude.ts
import * as amplitude from '@amplitude/analytics-browser';

export function initAmplitude() {
  amplitude.init(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY!, undefined, {
    defaultTracking: {
      sessions: true,
      pageViews: true,
      formInteractions: true,
      fileDownloads: true,
    },
  });
  return amplitude;
}
```

---

## Unified Analytics Interface

```typescript
// lib/analytics/index.ts
import { posthog } from './posthog';
import { mixpanel } from './mixpanel';

type AnalyticsProvider = 'posthog' | 'mixpanel' | 'amplitude';

interface TrackingEvent {
  name: string;
  properties?: Record<string, unknown>;
  userId?: string;
}

interface UserIdentity {
  userId: string;
  traits?: Record<string, unknown>;
}

class Analytics {
  private providers: AnalyticsProvider[];

  constructor(providers: AnalyticsProvider[] = ['posthog']) {
    this.providers = providers;
  }

  // Identify user across all providers
  identify({ userId, traits }: UserIdentity) {
    if (this.providers.includes('posthog')) {
      posthog.identify(userId, traits);
    }
    if (this.providers.includes('mixpanel')) {
      mixpanel.identify(userId);
      if (traits) mixpanel.people.set(traits);
    }
    if (this.providers.includes('amplitude')) {
      amplitude.setUserId(userId);
      if (traits) amplitude.identify(new amplitude.Identify().set(traits));
    }
  }

  // Track event across all providers
  track({ name, properties }: TrackingEvent) {
    const enrichedProps = {
      ...properties,
      timestamp: new Date().toISOString(),
      page_url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    if (this.providers.includes('posthog')) {
      posthog.capture(name, enrichedProps);
    }
    if (this.providers.includes('mixpanel')) {
      mixpanel.track(name, enrichedProps);
    }
    if (this.providers.includes('amplitude')) {
      amplitude.track(name, enrichedProps);
    }
  }

  // Track page view
  page(pageName?: string, properties?: Record<string, unknown>) {
    const pageProps = {
      ...properties,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    };

    if (this.providers.includes('posthog')) {
      posthog.capture('$pageview', pageProps);
    }
    if (this.providers.includes('mixpanel')) {
      mixpanel.track_pageview(pageProps);
    }
    if (this.providers.includes('amplitude')) {
      amplitude.track('Page View', { page_name: pageName, ...pageProps });
    }
  }

  // Reset on logout
  reset() {
    if (this.providers.includes('posthog')) posthog.reset();
    if (this.providers.includes('mixpanel')) mixpanel.reset();
    if (this.providers.includes('amplitude')) amplitude.reset();
  }

  // Set group/organization
  group(groupType: string, groupId: string, traits?: Record<string, unknown>) {
    if (this.providers.includes('posthog')) {
      posthog.group(groupType, groupId, traits);
    }
    if (this.providers.includes('mixpanel')) {
      mixpanel.set_group(groupType, groupId);
    }
  }
}

export const analytics = new Analytics(['posthog']);
```

---

## React Integration

### Provider Component

```tsx
// providers/analytics-provider.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { analytics } from '@/lib/analytics';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route change
  useEffect(() => {
    analytics.page(pathname, {
      search: searchParams.toString(),
    });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
```

### Hooks

```tsx
// hooks/use-analytics.ts
import { useCallback } from 'react';
import { analytics } from '@/lib/analytics';

export function useAnalytics() {
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    analytics.track({ name: event, properties });
  }, []);

  const identify = useCallback((userId: string, traits?: Record<string, unknown>) => {
    analytics.identify({ userId, traits });
  }, []);

  return { track, identify };
}

// Usage
function CheckoutButton() {
  const { track } = useAnalytics();

  return (
    <button onClick={() => track('Checkout Started', { cart_value: 99.99 })}>
      Checkout
    </button>
  );
}
```

---

## Standard Event Library

```typescript
// lib/analytics/events.ts

// Authentication Events
export const AuthEvents = {
  SIGNUP_STARTED: 'Signup Started',
  SIGNUP_COMPLETED: 'Signup Completed',
  SIGNUP_FAILED: 'Signup Failed',
  LOGIN_STARTED: 'Login Started',
  LOGIN_COMPLETED: 'Login Completed',
  LOGIN_FAILED: 'Login Failed',
  LOGOUT: 'Logout',
  PASSWORD_RESET_REQUESTED: 'Password Reset Requested',
  PASSWORD_RESET_COMPLETED: 'Password Reset Completed',
} as const;

// Onboarding Events
export const OnboardingEvents = {
  ONBOARDING_STARTED: 'Onboarding Started',
  ONBOARDING_STEP_COMPLETED: 'Onboarding Step Completed',
  ONBOARDING_COMPLETED: 'Onboarding Completed',
  ONBOARDING_SKIPPED: 'Onboarding Skipped',
} as const;

// Feature Usage Events
export const FeatureEvents = {
  FEATURE_VIEWED: 'Feature Viewed',
  FEATURE_USED: 'Feature Used',
  FEATURE_ERROR: 'Feature Error',
} as const;

// Billing Events
export const BillingEvents = {
  PRICING_VIEWED: 'Pricing Viewed',
  PLAN_SELECTED: 'Plan Selected',
  CHECKOUT_STARTED: 'Checkout Started',
  CHECKOUT_COMPLETED: 'Checkout Completed',
  CHECKOUT_FAILED: 'Checkout Failed',
  SUBSCRIPTION_UPGRADED: 'Subscription Upgraded',
  SUBSCRIPTION_DOWNGRADED: 'Subscription Downgraded',
  SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
  TRIAL_STARTED: 'Trial Started',
  TRIAL_ENDED: 'Trial Ended',
} as const;

// Engagement Events
export const EngagementEvents = {
  SEARCH_PERFORMED: 'Search Performed',
  FILTER_APPLIED: 'Filter Applied',
  ITEM_CLICKED: 'Item Clicked',
  ITEM_VIEWED: 'Item Viewed',
  ITEM_CREATED: 'Item Created',
  ITEM_UPDATED: 'Item Updated',
  ITEM_DELETED: 'Item Deleted',
  EXPORT_REQUESTED: 'Export Requested',
  SHARE_CLICKED: 'Share Clicked',
  FEEDBACK_SUBMITTED: 'Feedback Submitted',
} as const;

// Error Events
export const ErrorEvents = {
  ERROR_OCCURRED: 'Error Occurred',
  ERROR_BOUNDARY_TRIGGERED: 'Error Boundary Triggered',
  API_ERROR: 'API Error',
  VALIDATION_ERROR: 'Validation Error',
} as const;
```

---

## Server-Side Tracking

```typescript
// lib/analytics/server.ts
import { posthogServer } from './posthog';

interface ServerEvent {
  userId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export async function trackServerEvent({ userId, event, properties }: ServerEvent) {
  try {
    posthogServer.capture({
      distinctId: userId,
      event,
      properties: {
        ...properties,
        $lib: 'server',
        timestamp: new Date().toISOString(),
      },
    });

    // Flush immediately for important events
    await posthogServer.flush();
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Don't throw - analytics should never break the app
  }
}

// Usage in API route
export async function POST(request: Request) {
  const { userId, orderId } = await request.json();

  await trackServerEvent({
    userId,
    event: 'Order Completed',
    properties: { orderId, source: 'api' },
  });

  return Response.json({ success: true });
}
```

---

## Funnel Tracking

```typescript
// lib/analytics/funnels.ts
import { analytics } from './index';

interface FunnelStep {
  name: string;
  properties?: Record<string, unknown>;
}

class FunnelTracker {
  private funnelName: string;
  private startTime: number;
  private steps: string[] = [];

  constructor(funnelName: string) {
    this.funnelName = funnelName;
    this.startTime = Date.now();

    analytics.track({
      name: `${funnelName} Started`,
      properties: { funnel: funnelName },
    });
  }

  step(step: FunnelStep) {
    this.steps.push(step.name);

    analytics.track({
      name: `${this.funnelName} Step`,
      properties: {
        funnel: this.funnelName,
        step_name: step.name,
        step_number: this.steps.length,
        time_since_start_ms: Date.now() - this.startTime,
        ...step.properties,
      },
    });
  }

  complete(properties?: Record<string, unknown>) {
    analytics.track({
      name: `${this.funnelName} Completed`,
      properties: {
        funnel: this.funnelName,
        total_steps: this.steps.length,
        total_time_ms: Date.now() - this.startTime,
        steps_completed: this.steps,
        ...properties,
      },
    });
  }

  abandon(reason?: string) {
    analytics.track({
      name: `${this.funnelName} Abandoned`,
      properties: {
        funnel: this.funnelName,
        steps_completed: this.steps.length,
        last_step: this.steps[this.steps.length - 1],
        time_spent_ms: Date.now() - this.startTime,
        abandon_reason: reason,
      },
    });
  }
}

// Usage
const checkoutFunnel = new FunnelTracker('Checkout');
checkoutFunnel.step({ name: 'Cart Viewed' });
checkoutFunnel.step({ name: 'Shipping Added', properties: { method: 'express' } });
checkoutFunnel.step({ name: 'Payment Added' });
checkoutFunnel.complete({ order_total: 149.99 });
```

---

## React Hook for Funnels

```tsx
// hooks/use-funnel.ts
import { useRef, useEffect, useCallback } from 'react';
import { FunnelTracker } from '@/lib/analytics/funnels';

export function useFunnel(funnelName: string) {
  const funnelRef = useRef<FunnelTracker | null>(null);

  useEffect(() => {
    funnelRef.current = new FunnelTracker(funnelName);

    return () => {
      // Auto-abandon if component unmounts before completion
      if (funnelRef.current) {
        funnelRef.current.abandon('Component unmounted');
      }
    };
  }, [funnelName]);

  const step = useCallback((name: string, properties?: Record<string, unknown>) => {
    funnelRef.current?.step({ name, properties });
  }, []);

  const complete = useCallback((properties?: Record<string, unknown>) => {
    funnelRef.current?.complete(properties);
    funnelRef.current = null; // Prevent abandon on unmount
  }, []);

  const abandon = useCallback((reason?: string) => {
    funnelRef.current?.abandon(reason);
    funnelRef.current = null;
  }, []);

  return { step, complete, abandon };
}
```

---

## Custom Dashboard Metrics

### Database Schema for Custom Analytics

```typescript
// db/schema/analytics.ts
import { pgTable, text, timestamp, jsonb, integer, uuid, index } from 'drizzle-orm/pg-core';

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id'),
  sessionId: text('session_id'),
  eventName: text('event_name').notNull(),
  properties: jsonb('properties'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('analytics_tenant_idx').on(table.tenantId),
  eventIdx: index('analytics_event_idx').on(table.eventName),
  createdAtIdx: index('analytics_created_idx').on(table.createdAt),
  compositeIdx: index('analytics_composite_idx').on(table.tenantId, table.eventName, table.createdAt),
}));

export const analyticsMetrics = pgTable('analytics_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  metricName: text('metric_name').notNull(),
  metricValue: integer('metric_value').notNull(),
  dimensions: jsonb('dimensions'),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantMetricIdx: index('metrics_tenant_idx').on(table.tenantId, table.metricName),
  periodIdx: index('metrics_period_idx').on(table.periodStart, table.periodEnd),
}));
```

### Metrics Aggregation

```typescript
// lib/analytics/metrics.ts
import { db } from '@/db';
import { analyticsEvents, analyticsMetrics } from '@/db/schema';
import { sql, eq, gte, lte, and, count } from 'drizzle-orm';

interface MetricQuery {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}

// Get event counts by name
export async function getEventCounts({ tenantId, startDate, endDate }: MetricQuery) {
  return db
    .select({
      eventName: analyticsEvents.eventName,
      count: count(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.tenantId, tenantId),
        gte(analyticsEvents.createdAt, startDate),
        lte(analyticsEvents.createdAt, endDate)
      )
    )
    .groupBy(analyticsEvents.eventName)
    .orderBy(sql`count(*) desc`);
}

// Get daily active users
export async function getDailyActiveUsers({ tenantId, startDate, endDate }: MetricQuery) {
  return db
    .select({
      date: sql<string>`date_trunc('day', ${analyticsEvents.createdAt})`,
      uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.tenantId, tenantId),
        gte(analyticsEvents.createdAt, startDate),
        lte(analyticsEvents.createdAt, endDate)
      )
    )
    .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`);
}

// Get feature usage breakdown
export async function getFeatureUsage({ tenantId, startDate, endDate }: MetricQuery) {
  return db
    .select({
      feature: sql<string>`${analyticsEvents.properties}->>'feature'`,
      totalUses: count(),
      uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.tenantId, tenantId),
        eq(analyticsEvents.eventName, 'Feature Used'),
        gte(analyticsEvents.createdAt, startDate),
        lte(analyticsEvents.createdAt, endDate)
      )
    )
    .groupBy(sql`${analyticsEvents.properties}->>'feature'`)
    .orderBy(sql`count(*) desc`);
}

// Get conversion rate
export async function getConversionRate(
  { tenantId, startDate, endDate }: MetricQuery,
  startEvent: string,
  endEvent: string
) {
  const [started, completed] = await Promise.all([
    db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          eq(analyticsEvents.eventName, startEvent),
          gte(analyticsEvents.createdAt, startDate),
          lte(analyticsEvents.createdAt, endDate)
        )
      ),
    db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          eq(analyticsEvents.eventName, endEvent),
          gte(analyticsEvents.createdAt, startDate),
          lte(analyticsEvents.createdAt, endDate)
        )
      ),
  ]);

  const startCount = started[0]?.count ?? 0;
  const endCount = completed[0]?.count ?? 0;

  return {
    started: startCount,
    completed: endCount,
    conversionRate: startCount > 0 ? (endCount / startCount) * 100 : 0,
  };
}
```

---

## Dashboard Components

```tsx
// components/analytics/metric-card.tsx
interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, change, changeLabel, icon }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold">{value}</p>
        {change !== undefined && (
          <p className={cn(
            "text-xs mt-1",
            isPositive && "text-green-600",
            isNegative && "text-red-600",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive && '+'}
            {change.toFixed(1)}%{' '}
            <span className="text-muted-foreground">{changeLabel || 'vs last period'}</span>
          </p>
        )}
      </div>
    </div>
  );
}
```

```tsx
// components/analytics/chart.tsx
'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  xAxisKey: string;
  type?: 'line' | 'bar';
  color?: string;
}

export function AnalyticsChart({
  data,
  dataKey,
  xAxisKey,
  type = 'line',
  color = 'hsl(var(--primary))'
}: ChartProps) {
  const Chart = type === 'line' ? LineChart : BarChart;
  const DataComponent = type === 'line' ? Line : Bar;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Chart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey={xAxisKey}
          className="text-xs text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          className="text-xs text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <DataComponent
          dataKey={dataKey}
          fill={color}
          stroke={color}
          strokeWidth={2}
          radius={type === 'bar' ? [4, 4, 0, 0] : undefined}
        />
      </Chart>
    </ResponsiveContainer>
  );
}
```

---

## A/B Testing Integration

```typescript
// lib/analytics/experiments.ts
import { posthog } from './posthog';

interface Experiment {
  name: string;
  variants: string[];
  defaultVariant: string;
}

export function getExperimentVariant(experiment: Experiment): string {
  if (typeof window === 'undefined') {
    return experiment.defaultVariant;
  }

  // Get variant from PostHog feature flag
  const variant = posthog.getFeatureFlag(experiment.name);

  if (typeof variant === 'string' && experiment.variants.includes(variant)) {
    return variant;
  }

  return experiment.defaultVariant;
}

// React hook
export function useExperiment(experimentName: string, variants: string[], defaultVariant: string) {
  const [variant, setVariant] = useState(defaultVariant);

  useEffect(() => {
    const v = getExperimentVariant({ name: experimentName, variants, defaultVariant });
    setVariant(v);

    // Track exposure
    analytics.track({
      name: 'Experiment Viewed',
      properties: {
        experiment: experimentName,
        variant: v,
      },
    });
  }, [experimentName, variants, defaultVariant]);

  return variant;
}

// Usage
function PricingPage() {
  const pricingVariant = useExperiment('pricing-page', ['control', 'annual-focus', 'social-proof'], 'control');

  return (
    <>
      {pricingVariant === 'control' && <StandardPricing />}
      {pricingVariant === 'annual-focus' && <AnnualFocusPricing />}
      {pricingVariant === 'social-proof' && <SocialProofPricing />}
    </>
  );
}
```

---

## Privacy & Consent

```typescript
// lib/analytics/consent.ts
const CONSENT_KEY = 'analytics_consent';

export function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'granted';
}

export function setConsent(granted: boolean) {
  localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');

  if (granted) {
    analytics.track({ name: 'Consent Granted' });
  } else {
    analytics.reset();
  }
}

// Consent-aware tracking
export function trackIfConsented(event: string, properties?: Record<string, unknown>) {
  if (hasConsent()) {
    analytics.track({ name: event, properties });
  }
}
```

```tsx
// components/cookie-consent.tsx
'use client';

import { useState, useEffect } from 'react';
import { hasConsent, setConsent } from '@/lib/analytics/consent';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('analytics_consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          We use cookies to improve your experience and analyze site usage.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setConsent(false);
              setShowBanner(false);
            }}
            className="px-4 py-2 text-sm border rounded-lg"
          >
            Decline
          </button>
          <button
            onClick={() => {
              setConsent(true);
              setShowBanner(false);
            }}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Quality Checklist

Before shipping analytics:
- [ ] User identity persists across sessions
- [ ] Events fire on all important actions
- [ ] Properties include necessary context
- [ ] Server-side events work for webhooks
- [ ] Consent banner implemented (GDPR/CCPA)
- [ ] Analytics don't block UI rendering
- [ ] Error tracking doesn't expose PII
- [ ] Dashboard shows actionable metrics
- [ ] Funnels track conversion accurately
- [ ] A/B tests have proper variant tracking
