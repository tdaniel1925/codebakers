# BACKGROUND JOBS & QUEUES
# Module: 06d-background-jobs.md
# Load with: 00-core.md
# Covers: Inngest, scheduled tasks, cron jobs

---

## INNGEST INTEGRATION

### Inngest Setup

```typescript
// lib/inngest/client.ts
import { Inngest, EventSchemas } from 'inngest';

// Define your event types
type Events = {
  'user/created': {
    data: {
      userId: string;
      email: string;
      name: string;
    };
  };
  'email/send': {
    data: {
      to: string;
      subject: string;
      template: string;
      variables: Record<string, string>;
    };
  };
  'subscription/created': {
    data: {
      organizationId: string;
      plan: string;
    };
  };
  'report/generate': {
    data: {
      organizationId: string;
      reportType: string;
      dateRange: {
        start: string;
        end: string;
      };
    };
  };
};

export const inngest = new Inngest({
  id: 'your-app',
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

### Inngest Functions

```typescript
// lib/inngest/functions.ts
import { inngest } from './client';
import { EmailService } from '@/services/email-service';
import { ReportService } from '@/services/report-service';
import { db } from '@/db';
import { sessions, auditLogs } from '@/db/schema';
import { lt } from 'drizzle-orm';

// Welcome email after signup
export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/created' },
  async ({ event, step }) => {
    const { userId, email, name } = event.data;

    // Step 1: Send welcome email
    await step.run('send-email', async () => {
      await EmailService.send({
        to: email,
        template: 'welcome',
        variables: { name },
      });
    });

    // Step 2: Wait 1 day
    await step.sleep('wait-1-day', '1d');

    // Step 3: Send tips email
    await step.run('send-tips-email', async () => {
      await EmailService.send({
        to: email,
        template: 'getting-started-tips',
        variables: { name },
      });
    });

    // Step 4: Wait 3 days
    await step.sleep('wait-3-days', '3d');

    // Step 5: Check if user is active
    const isActive = await step.run('check-activity', async () => {
      const user = await UserService.getById(userId);
      return user?.lastActiveAt &&
        new Date(user.lastActiveAt) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    });

    // Step 6: Send re-engagement if inactive
    if (!isActive) {
      await step.run('send-reengagement', async () => {
        await EmailService.send({
          to: email,
          template: 're-engagement',
          variables: { name },
        });
      });
    }

    return { success: true };
  }
);

// Generate report in background
export const generateReport = inngest.createFunction(
  {
    id: 'generate-report',
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: 'report/generate' },
  async ({ event, step }) => {
    const { organizationId, reportType, dateRange } = event.data;

    // Step 1: Fetch data
    const data = await step.run('fetch-data', async () => {
      return ReportService.fetchReportData(
        organizationId,
        reportType,
        dateRange
      );
    });

    // Step 2: Generate PDF
    const pdfUrl = await step.run('generate-pdf', async () => {
      return ReportService.generatePDF(data);
    });

    // Step 3: Notify user
    await step.run('notify-user', async () => {
      const org = await OrganizationService.getById(organizationId);
      await EmailService.send({
        to: org.adminEmail,
        template: 'report-ready',
        variables: {
          reportType,
          downloadUrl: pdfUrl,
        },
      });
    });

    return { pdfUrl };
  }
);

// Scheduled job: Daily cleanup
export const dailyCleanup = inngest.createFunction(
  { id: 'daily-cleanup' },
  { cron: '0 0 * * *' }, // Every day at midnight
  async ({ step }) => {
    // Clean up expired sessions
    await step.run('cleanup-sessions', async () => {
      await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date()));
    });

    // Clean up old audit logs
    await step.run('cleanup-audit-logs', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await db
        .delete(auditLogs)
        .where(lt(auditLogs.createdAt, thirtyDaysAgo));
    });

    // Clean up abandoned uploads
    await step.run('cleanup-uploads', async () => {
      await StorageService.cleanupOrphanedFiles();
    });

    return { success: true };
  }
);
```

### Inngest API Route

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import {
  sendWelcomeEmail,
  generateReport,
  dailyCleanup,
} from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendWelcomeEmail,
    generateReport,
    dailyCleanup,
  ],
});
```

### Triggering Events

```typescript
// Example: Trigger event after user signup
import { inngest } from '@/lib/inngest/client';

// In your signup handler:
await inngest.send({
  name: 'user/created',
  data: {
    userId: user.id,
    email: user.email,
    name: user.name,
  },
});

// In your report request handler:
await inngest.send({
  name: 'report/generate',
  data: {
    organizationId: org.id,
    reportType: 'monthly-summary',
    dateRange: {
      start: '2024-01-01',
      end: '2024-01-31',
    },
  },
});
```

---

## SCHEDULED TASK PATTERNS

### Cron Job Examples

```typescript
// src/jobs/scheduled-tasks.ts
import { inngest } from '@/lib/inngest';
import { db } from '@/db';
import { subscriptions, users, logs, sessions } from '@/db/schema';
import { eq, lt } from 'drizzle-orm';

// Daily: Send usage reports (9 AM daily)
export const sendDailyReports = inngest.createFunction(
  { id: 'send-daily-reports' },
  { cron: '0 9 * * *' },
  async ({ step }) => {
    const activeUsers = await step.run('get-users', () =>
      db.query.users.findMany({
        where: eq(users.emailReportsEnabled, true),
      })
    );

    for (const user of activeUsers) {
      await step.run(`send-report-${user.id}`, async () => {
        const report = await generateUsageReport(user.id);
        await sendEmail({
          to: user.email,
          subject: 'Your Daily Usage Report',
          template: 'daily-report',
          data: report,
        });
      });
    }

    return { sent: activeUsers.length };
  }
);

// Weekly: Clean up expired data (3 AM every Sunday)
export const weeklyCleanup = inngest.createFunction(
  { id: 'weekly-cleanup' },
  { cron: '0 3 * * 0' },
  async ({ step }) => {
    // Delete old logs (90 days)
    const deletedLogs = await step.run('delete-old-logs', () =>
      db.delete(logs).where(
        lt(logs.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      )
    );

    // Delete expired sessions
    const deletedSessions = await step.run('delete-expired-sessions', () =>
      db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    );

    return {
      deletedLogs: deletedLogs.rowCount,
      deletedSessions: deletedSessions.rowCount,
    };
  }
);

// Monthly: Generate invoices (Midnight on 1st of month)
export const monthlyInvoices = inngest.createFunction(
  { id: 'monthly-invoices' },
  { cron: '0 0 1 * *' },
  async ({ step }) => {
    const subscriptionsToInvoice = await step.run('get-subscriptions', () =>
      db.query.subscriptions.findMany({
        where: eq(subscriptions.status, 'active'),
      })
    );

    for (const sub of subscriptionsToInvoice) {
      await step.run(`invoice-${sub.id}`, async () => {
        await generateAndSendInvoice(sub);
      });
    }

    return { invoiced: subscriptionsToInvoice.length };
  }
);

// Every 5 minutes: Health check
export const healthCheck = inngest.createFunction(
  { id: 'health-check' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const checks = await step.run('run-checks', async () => {
      const results = {
        database: await checkDatabase(),
        redis: await checkRedis(),
        stripe: await checkStripe(),
      };
      return results;
    });

    const failed = Object.entries(checks).filter(([_, ok]) => !ok);

    if (failed.length > 0) {
      await step.run('alert', () =>
        sendAlert({
          type: 'health-check-failed',
          services: failed.map(([name]) => name),
        })
      );
    }

    return checks;
  }
);

// Hourly: Sync external data
export const hourlySync = inngest.createFunction(
  { id: 'hourly-sync' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.run('sync-stripe-subscriptions', syncStripeSubscriptions);
    await step.run('sync-analytics', syncAnalytics);
    await step.run('update-search-index', updateSearchIndex);
  }
);
```

### Cron Dashboard (Admin)

```typescript
// src/app/(admin)/admin/jobs/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const JOBS = [
  { id: 'send-daily-reports', name: 'Daily Reports', cron: '0 9 * * *' },
  { id: 'weekly-cleanup', name: 'Weekly Cleanup', cron: '0 3 * * 0' },
  { id: 'monthly-invoices', name: 'Monthly Invoices', cron: '0 0 1 * *' },
  { id: 'health-check', name: 'Health Check', cron: '*/5 * * * *' },
  { id: 'hourly-sync', name: 'Hourly Sync', cron: '0 * * * *' },
];

export default async function JobsPage() {
  const runs = await getRecentRuns();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Scheduled Jobs</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {JOBS.map((job) => {
          const lastRun = runs.find((r) => r.functionId === job.id);

          return (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{job.name}</CardTitle>
                  <Badge
                    variant={lastRun?.status === 'completed' ? 'default' : 'destructive'}
                  >
                    {lastRun?.status || 'unknown'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-mono mb-2">
                  {job.cron}
                </p>
                {lastRun && (
                  <p className="text-sm text-muted-foreground">
                    Last run: {formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true })}
                  </p>
                )}
                <form action={`/api/admin/jobs/${job.id}/trigger`} method="POST">
                  <Button type="submit" variant="outline" size="sm" className="mt-4">
                    Run Now
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

### Manual Trigger API

```typescript
// src/app/api/admin/jobs/[id]/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest';
import { isAdmin, getServerSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await inngest.send({
      name: `app/${params.id}`,
      data: { triggeredBy: session.user.id, manual: true },
    });

    return NextResponse.json({ success: true, jobId: params.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger job' }, { status: 500 });
  }
}
```

---

## Environment Variables

```env
# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

---
