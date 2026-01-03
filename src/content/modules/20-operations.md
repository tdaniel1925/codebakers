# OPERATIONS & POST-LAUNCH
# Module: 20-operations.md
# Load with: 00-core.md

---

## 📊 MONITORING & OBSERVABILITY

### Monitoring Stack Overview

```markdown
## Recommended Monitoring Stack

### Application Monitoring
- **Sentry** - Error tracking, performance monitoring
- **Vercel Analytics** - Core Web Vitals, traffic
- **PostHog** - Product analytics, session replay

### Infrastructure Monitoring
- **Vercel** - Serverless function logs, deployment status
- **Supabase** - Database metrics, connection pooling
- **Uptime Robot / Better Uptime** - External availability

### Alerting
- **PagerDuty / Opsgenie** - On-call scheduling
- **Slack** - Team notifications
- **Email** - Stakeholder notifications
```

### Sentry Integration

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

// Initialize in sentry.client.config.ts and sentry.server.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Filter events
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    
    // Filter out specific errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Ignore network errors from ad blockers
      if (error.message.includes('Network request failed')) {
        return null;
      }
      // Ignore cancelled requests
      if (error.name === 'AbortError') {
        return null;
      }
    }
    
    return event;
  },
  
  // Add custom tags
  initialScope: {
    tags: {
      app_version: process.env.NEXT_PUBLIC_APP_VERSION,
    },
  },
});

// Helper to set user context
export function setSentryUser(user: { id: string; email?: string; plan?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
  Sentry.setTag('plan', user.plan);
}

// Helper to capture exceptions with context
export function captureException(
  error: Error,
  context?: Record<string, unknown>
) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    Sentry.captureException(error);
  });
}

// Helper for custom events
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context) {
      scope.setContext('details', context);
    }
    Sentry.captureMessage(message);
  });
}
```

### Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: CheckResult;
    cache?: CheckResult;
    external?: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'fail';
  latency?: number;
  message?: string;
}

export async function GET() {
  const checks: HealthCheck['checks'] = {
    database: await checkDatabase(),
  };

  const status = Object.values(checks).every((c) => c.status === 'pass')
    ? 'healthy'
    : Object.values(checks).some((c) => c.status === 'fail')
    ? 'unhealthy'
    : 'degraded';

  const response: HealthCheck = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    checks,
  };

  return NextResponse.json(response, {
    status: status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503,
  });
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: 'pass',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Kubernetes-style probes
// app/api/health/live/route.ts
export async function GET() {
  // Liveness - is the app running?
  return NextResponse.json({ status: 'ok' });
}

// app/api/health/ready/route.ts
export async function GET() {
  // Readiness - can the app accept traffic?
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ready' });
  } catch {
    return NextResponse.json({ status: 'not ready' }, { status: 503 });
  }
}
```

### Logging Service

```typescript
// lib/monitoring/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

class StructuredLogger implements Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new StructuredLogger({
      ...this.context,
      ...additionalContext,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...context,
    };

    // In production, output JSON for log aggregation
    if (process.env.NODE_ENV === 'production') {
      console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
    } else {
      // In development, use pretty formatting
      const prefix = `[${level.toUpperCase()}]`;
      console[level === 'debug' ? 'log' : level](prefix, message, context || '');
    }
  }

  debug(message: string, context?: LogContext) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }
}

// Singleton instance
export const logger = new StructuredLogger();

// Create request-scoped logger
export function createRequestLogger(requestId: string, userId?: string) {
  return new StructuredLogger({
    requestId,
    userId,
  });
}

// Usage
// logger.info('User signed up', { userId: '123', plan: 'pro' });
// logger.error('Payment failed', error, { userId: '123', amount: 99 });
```

---

## 🚨 INCIDENT RESPONSE

### Incident Severity Levels

```markdown
## Incident Severity Matrix

### SEV1 - Critical
- **Definition:** Complete service outage, data breach, security incident
- **Response time:** 15 minutes
- **Communication:** All hands, customer notice required
- **Examples:**
  - Site completely down
  - Database unavailable
  - Payment processing broken
  - Security breach detected

### SEV2 - High
- **Definition:** Major feature broken, significant performance degradation
- **Response time:** 1 hour
- **Communication:** Engineering team, PM notified
- **Examples:**
  - Authentication failing
  - Core feature not working
  - 50%+ error rate
  - Major third-party integration down

### SEV3 - Medium
- **Definition:** Minor feature broken, edge cases failing
- **Response time:** 4 hours
- **Communication:** Assigned engineer
- **Examples:**
  - Non-critical feature broken
  - Minor UI bugs
  - Slow performance for subset of users
  - Low error rate increase

### SEV4 - Low
- **Definition:** Cosmetic issues, improvement opportunities
- **Response time:** Next sprint
- **Communication:** Tracked in backlog
- **Examples:**
  - Typos
  - Minor styling issues
  - Feature requests
```

### Incident Response Runbook

```markdown
## Incident Response Runbook

### 1. Detection & Triage (0-5 min)
- [ ] Acknowledge alert in monitoring system
- [ ] Assess severity using matrix above
- [ ] Create incident channel in Slack: #incident-YYYY-MM-DD-brief-description
- [ ] Assign Incident Commander (IC) and Communications Lead

### 2. Initial Response (5-15 min)
- [ ] IC: Post initial status to incident channel
- [ ] IC: Determine if rollback is needed
- [ ] IC: Identify subject matter experts needed
- [ ] Comms: Draft initial customer communication (if SEV1/2)

### 3. Investigation (15-60 min)
- [ ] Review recent deployments
- [ ] Check error logs and monitoring dashboards
- [ ] Identify affected scope (users, features, regions)
- [ ] Document timeline of events
- [ ] Test hypotheses systematically

### 4. Mitigation
- [ ] Implement fix or rollback
- [ ] Verify fix in staging (if time permits)
- [ ] Deploy fix
- [ ] Monitor for resolution
- [ ] Update status page

### 5. Communication (ongoing)
**Internal:**
- Update incident channel every 15-30 minutes
- Escalate if needed

**External (SEV1/2):**
- Status page update within 30 minutes
- Email to affected customers for data incidents
- Social media acknowledgment if viral

### 6. Resolution
- [ ] Confirm metrics return to baseline
- [ ] Update status page to "Resolved"
- [ ] Send final customer communication
- [ ] Close incident channel

### 7. Post-Mortem (within 48 hours)
- [ ] Schedule post-mortem meeting
- [ ] Document timeline
- [ ] Identify root cause
- [ ] List action items
- [ ] Assign owners and due dates
- [ ] Share learnings with team
```

### Status Page Integration

```typescript
// lib/status/statuspage.ts

interface StatusPageConfig {
  apiKey: string;
  pageId: string;
}

type ComponentStatus = 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage';
type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export class StatusPageService {
  private config: StatusPageConfig;
  private baseUrl = 'https://api.statuspage.io/v1';

  constructor(config: StatusPageConfig) {
    this.config = config;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `OAuth ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`StatusPage API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update component status
   */
  async updateComponentStatus(componentId: string, status: ComponentStatus) {
    return this.request(
      `/pages/${this.config.pageId}/components/${componentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          component: { status },
        }),
      }
    );
  }

  /**
   * Create incident
   */
  async createIncident(params: {
    name: string;
    status: IncidentStatus;
    message: string;
    componentIds?: string[];
    componentStatus?: ComponentStatus;
  }) {
    return this.request(`/pages/${this.config.pageId}/incidents`, {
      method: 'POST',
      body: JSON.stringify({
        incident: {
          name: params.name,
          status: params.status,
          body: params.message,
          component_ids: params.componentIds,
          components: params.componentIds?.reduce(
            (acc, id) => ({
              ...acc,
              [id]: params.componentStatus || 'degraded_performance',
            }),
            {}
          ),
        },
      }),
    });
  }

  /**
   * Update incident
   */
  async updateIncident(
    incidentId: string,
    params: {
      status: IncidentStatus;
      message: string;
    }
  ) {
    return this.request(
      `/pages/${this.config.pageId}/incidents/${incidentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          incident: {
            status: params.status,
            body: params.message,
          },
        }),
      }
    );
  }

  /**
   * Resolve incident
   */
  async resolveIncident(incidentId: string, message: string) {
    return this.updateIncident(incidentId, {
      status: 'resolved',
      message,
    });
  }
}

// Usage
const statusPage = new StatusPageService({
  apiKey: process.env.STATUSPAGE_API_KEY!,
  pageId: process.env.STATUSPAGE_PAGE_ID!,
});

// During incident
await statusPage.createIncident({
  name: 'Elevated Error Rates',
  status: 'investigating',
  message: 'We are investigating elevated error rates affecting some users.',
  componentIds: ['api', 'dashboard'],
  componentStatus: 'degraded_performance',
});
```

---

## 🎫 SUPPORT SYSTEM

### Support Ticket Schema

```typescript
// db/schema/support.ts
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'pending',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'billing',
  'technical',
  'feature_request',
  'bug_report',
  'account',
  'other',
]);

export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  category: ticketCategoryEnum('category').notNull(),
  priority: ticketPriorityEnum('priority').default('medium').notNull(),
  status: ticketStatusEnum('status').default('open').notNull(),
  
  assignedTo: uuid('assigned_to').references(() => users.id),
  
  // Metadata
  tags: text('tags').array(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  firstResponseAt: timestamp('first_response_at'),
});

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').references(() => supportTickets.id).notNull(),
  
  authorId: uuid('author_id').references(() => users.id).notNull(),
  authorType: text('author_type').$type<'customer' | 'agent' | 'system'>().notNull(),
  
  content: text('content').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(), // Internal notes
  
  attachments: jsonb('attachments').$type<Array<{
    name: string;
    url: string;
    size: number;
    type: string;
  }>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Support Service

```typescript
// services/support-service.ts
import { db } from '@/db';
import { supportTickets, ticketMessages } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/resend';

export class SupportService {
  /**
   * Create support ticket
   */
  static async createTicket(params: {
    userId: string;
    organizationId?: string;
    subject: string;
    description: string;
    category: typeof supportTickets.$inferInsert['category'];
    priority?: typeof supportTickets.$inferInsert['priority'];
    metadata?: Record<string, unknown>;
  }) {
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: params.userId,
        organizationId: params.organizationId,
        subject: params.subject,
        description: params.description,
        category: params.category,
        priority: params.priority || 'medium',
        metadata: params.metadata,
      })
      .returning();

    // Add initial message
    await db.insert(ticketMessages).values({
      ticketId: ticket.id,
      authorId: params.userId,
      authorType: 'customer',
      content: params.description,
    });

    // Notify support team
    await this.notifyNewTicket(ticket);

    return ticket;
  }

  /**
   * Reply to ticket
   */
  static async addReply(params: {
    ticketId: string;
    authorId: string;
    authorType: 'customer' | 'agent';
    content: string;
    isInternal?: boolean;
    attachments?: Array<{ name: string; url: string; size: number; type: string }>;
  }) {
    const [message] = await db
      .insert(ticketMessages)
      .values({
        ticketId: params.ticketId,
        authorId: params.authorId,
        authorType: params.authorType,
        content: params.content,
        isInternal: params.isInternal || false,
        attachments: params.attachments,
      })
      .returning();

    // Update ticket
    const updateData: Partial<typeof supportTickets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (params.authorType === 'agent' && !params.isInternal) {
      // Track first response time
      const ticket = await this.getTicket(params.ticketId);
      if (!ticket?.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }
      updateData.status = 'waiting_customer';
    } else if (params.authorType === 'customer') {
      updateData.status = 'pending';
    }

    await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, params.ticketId));

    // Send notification
    if (!params.isInternal) {
      if (params.authorType === 'agent') {
        await this.notifyCustomerReply(params.ticketId, params.content);
      } else {
        await this.notifyAgentReply(params.ticketId);
      }
    }

    return message;
  }

  /**
   * Update ticket status
   */
  static async updateStatus(
    ticketId: string,
    status: typeof supportTickets.$inferInsert['status'],
    agentId?: string
  ) {
    const updateData: Partial<typeof supportTickets.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId));

    // Add system message
    if (agentId) {
      await db.insert(ticketMessages).values({
        ticketId,
        authorId: agentId,
        authorType: 'system',
        content: `Ticket status changed to: ${status}`,
        isInternal: true,
      });
    }
  }

  /**
   * Get ticket with messages
   */
  static async getTicket(ticketId: string) {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!ticket) return null;

    const messages = await db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);

    return { ...ticket, messages };
  }

  /**
   * Get user's tickets
   */
  static async getUserTickets(userId: string) {
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  /**
   * Notify support team of new ticket
   */
  private static async notifyNewTicket(
    ticket: typeof supportTickets.$inferSelect
  ) {
    // Could integrate with Slack, Discord, or email
    await resend.emails.send({
      from: EMAIL_FROM.support,
      to: process.env.SUPPORT_EMAIL!,
      subject: `[${ticket.priority.toUpperCase()}] New ticket: ${ticket.subject}`,
      text: `
New support ticket received:

Subject: ${ticket.subject}
Category: ${ticket.category}
Priority: ${ticket.priority}

Description:
${ticket.description}

View ticket: ${process.env.NEXT_PUBLIC_URL}/admin/support/${ticket.id}
      `.trim(),
    });
  }

  /**
   * Notify customer of agent reply
   */
  private static async notifyCustomerReply(ticketId: string, content: string) {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return;

    // Get customer email
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ticket.userId!))
      .limit(1);

    if (!user?.email) return;

    await resend.emails.send({
      from: EMAIL_FROM.support,
      to: user.email,
      subject: `Re: ${ticket.subject} [#${ticketId.slice(0, 8)}]`,
      text: `
We've responded to your support request:

${content}

---
To reply, respond to this email or visit:
${process.env.NEXT_PUBLIC_URL}/support/tickets/${ticketId}
      `.trim(),
    });
  }

  /**
   * Notify agent of customer reply
   */
  private static async notifyAgentReply(ticketId: string) {
    // Implement Slack notification or similar
  }
}
```

### Support API Routes

```typescript
// app/api/support/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { SupportService } from '@/services/support-service';
import { z } from 'zod';

const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  category: z.enum(['billing', 'technical', 'feature_request', 'bug_report', 'account', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = createTicketSchema.parse(body);

    const ticket = await SupportService.createTicket({
      userId: user.id,
      organizationId: user.organizationId,
      ...data,
      metadata: {
        userAgent: req.headers.get('user-agent'),
        url: req.headers.get('referer'),
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tickets = await SupportService.getUserTickets(user.id);
  return NextResponse.json(tickets);
}
```

---

## 📈 PRODUCT ITERATION

### Feature Flag System

```typescript
// lib/features/flags.ts
import { db } from '@/db';
import { featureFlags, featureFlagOverrides } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number;
  allowedPlans?: string[];
  allowedUsers?: string[];
}

export class FeatureFlagService {
  private static cache = new Map<string, FeatureFlag>();
  private static cacheExpiry = 60000; // 1 minute
  private static lastFetch = 0;

  /**
   * Check if feature is enabled for user
   */
  static async isEnabled(
    flagName: string,
    context?: {
      userId?: string;
      organizationId?: string;
      plan?: string;
    }
  ): Promise<boolean> {
    const flag = await this.getFlag(flagName);
    if (!flag || !flag.enabled) return false;

    // Check user override
    if (context?.userId) {
      const override = await this.getUserOverride(flagName, context.userId);
      if (override !== null) return override;
    }

    // Check organization override
    if (context?.organizationId) {
      const override = await this.getOrgOverride(flagName, context.organizationId);
      if (override !== null) return override;
    }

    // Check plan restriction
    if (flag.allowedPlans?.length && context?.plan) {
      if (!flag.allowedPlans.includes(context.plan)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const bucket = this.getBucket(context?.userId || context?.organizationId || 'anonymous');
      return bucket < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get flag configuration
   */
  private static async getFlag(name: string): Promise<FeatureFlag | null> {
    // Check cache
    if (Date.now() - this.lastFetch < this.cacheExpiry && this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Fetch from database
    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.name, name))
      .limit(1);

    if (flag) {
      this.cache.set(name, flag as FeatureFlag);
      this.lastFetch = Date.now();
    }

    return flag as FeatureFlag | null;
  }

  /**
   * Get user override for flag
   */
  private static async getUserOverride(
    flagName: string,
    userId: string
  ): Promise<boolean | null> {
    const [override] = await db
      .select()
      .from(featureFlagOverrides)
      .where(
        and(
          eq(featureFlagOverrides.flagName, flagName),
          eq(featureFlagOverrides.userId, userId)
        )
      )
      .limit(1);

    return override?.enabled ?? null;
  }

  /**
   * Get organization override for flag
   */
  private static async getOrgOverride(
    flagName: string,
    organizationId: string
  ): Promise<boolean | null> {
    const [override] = await db
      .select()
      .from(featureFlagOverrides)
      .where(
        and(
          eq(featureFlagOverrides.flagName, flagName),
          eq(featureFlagOverrides.organizationId, organizationId)
        )
      )
      .limit(1);

    return override?.enabled ?? null;
  }

  /**
   * Deterministic bucket assignment for rollouts
   */
  private static getBucket(identifier: string): number {
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = (hash << 5) - hash + identifier.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Create or update flag
   */
  static async setFlag(flag: FeatureFlag) {
    await db
      .insert(featureFlags)
      .values(flag)
      .onConflictDoUpdate({
        target: featureFlags.name,
        set: flag,
      });
    this.cache.delete(flag.name);
  }

  /**
   * Set override for user or org
   */
  static async setOverride(params: {
    flagName: string;
    userId?: string;
    organizationId?: string;
    enabled: boolean;
  }) {
    await db.insert(featureFlagOverrides).values(params).onConflictDoUpdate({
      target: [
        featureFlagOverrides.flagName,
        featureFlagOverrides.userId,
        featureFlagOverrides.organizationId,
      ],
      set: { enabled: params.enabled },
    });
  }
}

// React hook
export function useFeatureFlag(flagName: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    FeatureFlagService.isEnabled(flagName, {
      userId: user?.id,
      organizationId: user?.organizationId,
      plan: user?.plan,
    }).then(setEnabled);
  }, [flagName, user]);

  return enabled;
}
```

### Feedback Collection

```typescript
// components/feedback-widget.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

interface FeedbackWidgetProps {
  feature?: string;
  context?: Record<string, unknown>;
}

export function FeedbackWidget({ feature, context }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature,
          rating,
          comment,
          context,
          url: window.location.href,
        }),
      });

      toast.success('Thanks for your feedback!');
      setIsOpen(false);
      setRating(null);
      setComment('');
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Feedback
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-background border rounded-lg shadow-lg p-4">
      <h3 className="font-medium mb-3">How was your experience?</h3>
      
      <div className="flex gap-2 mb-4">
        <Button
          variant={rating === 'positive' ? 'default' : 'outline'}
          onClick={() => setRating('positive')}
        >
          <ThumbsUp className="h-4 w-4 mr-2" />
          Good
        </Button>
        <Button
          variant={rating === 'negative' ? 'default' : 'outline'}
          onClick={() => setRating('negative')}
        >
          <ThumbsDown className="h-4 w-4 mr-2" />
          Needs work
        </Button>
      </div>

      {rating && (
        <>
          <Textarea
            placeholder="Tell us more (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-4"
          />
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              Submit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 📋 OPERATIONAL CHECKLISTS

### Daily Operations Checklist

```markdown
## Daily Operations Checklist

### Morning (9 AM)
- [ ] Check monitoring dashboards for anomalies
- [ ] Review overnight error logs
- [ ] Check support ticket queue
- [ ] Review scheduled deployments

### Midday (12 PM)
- [ ] Check system performance metrics
- [ ] Review any customer escalations
- [ ] Update status page if needed

### Evening (5 PM)
- [ ] Review day's deploys and their impact
- [ ] Check error rates trend
- [ ] Handoff any open issues to on-call
- [ ] Update team on any ongoing issues
```

### Weekly Operations Checklist

```markdown
## Weekly Operations Checklist

### Monday
- [ ] Review last week's metrics
- [ ] Plan week's deployments
- [ ] Check for security updates

### Wednesday
- [ ] Mid-week metrics review
- [ ] Backlog grooming for ops issues
- [ ] Check certificate expirations

### Friday
- [ ] Week in review document
- [ ] On-call handoff
- [ ] Weekend monitoring prep
- [ ] Update runbooks if needed
```

### Monthly Operations Checklist

```markdown
## Monthly Operations Checklist

### Infrastructure
- [ ] Review and rotate API keys/secrets
- [ ] Audit user access permissions
- [ ] Review cloud costs and optimize
- [ ] Test backup restoration
- [ ] Update dependencies

### Security
- [ ] Security scanning review
- [ ] Access log audit
- [ ] Penetration test results review
- [ ] Update incident response plan

### Performance
- [ ] Analyze performance trends
- [ ] Database optimization review
- [ ] CDN and caching audit
- [ ] Capacity planning review

### Business
- [ ] SLA compliance review
- [ ] Customer satisfaction metrics
- [ ] Support ticket analysis
- [ ] Feature usage analytics
```

---

## ENVIRONMENT VARIABLES

```bash
# .env.local

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx

# Status Page
STATUSPAGE_API_KEY=xxx
STATUSPAGE_PAGE_ID=xxx

# Support
SUPPORT_EMAIL=support@yourapp.com

# Logging
LOG_LEVEL=info
```

---

**Module complete.** This module covers monitoring, incident response, support systems, feature flags, and operational checklists for running a production SaaS application.
