# REALTIME & NOTIFICATIONS
# Module: 11-realtime.md
# Load with: 00-core.md
# Covers: WebSockets, notifications, search

---

# PART 29: NOTIFICATION SYSTEM

## 🔔 COMPLETE NOTIFICATION INFRASTRUCTURE

Multi-channel notification system: in-app, email, SMS, and push.

### Database Schema

```typescript
// db/schema.ts - Notification tables

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  
  // Channel preferences
  emailEnabled: boolean('email_enabled').default(true),
  smsEnabled: boolean('sms_enabled').default(false),
  pushEnabled: boolean('push_enabled').default(true),
  inAppEnabled: boolean('in_app_enabled').default(true),
  
  // Type preferences
  marketingEnabled: boolean('marketing_enabled').default(true),
  transactionalEnabled: boolean('transactional_enabled').default(true),
  securityEnabled: boolean('security_enabled').default(true),
  
  // Quiet hours
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false),
  quietHoursStart: text('quiet_hours_start'), // "22:00"
  quietHoursEnd: text('quiet_hours_end'),     // "08:00"
  timezone: text('timezone').default('America/Chicago'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex('notification_prefs_user_idx').on(table.userId),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  
  // Content
  type: text('type').notNull(), // booking_confirmed, payment_received, etc.
  category: text('category').notNull(), // transactional, marketing, security
  title: text('title').notNull(),
  body: text('body').notNull(),
  imageUrl: text('image_url'),
  
  // Action
  actionUrl: text('action_url'),
  actionLabel: text('action_label'),
  
  // Metadata
  data: jsonb('data').default({}),
  
  // Status
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  
  // Delivery tracking
  emailSent: boolean('email_sent').default(false),
  emailSentAt: timestamp('email_sent_at'),
  smsSent: boolean('sms_sent').default(false),
  smsSentAt: timestamp('sms_sent_at'),
  pushSent: boolean('push_sent').default(false),
  pushSentAt: timestamp('push_sent_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId),
  unreadIdx: index('notifications_unread_idx').on(table.userId, table.isRead),
  typeIdx: index('notifications_type_idx').on(table.type),
}));

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('push_subscriptions_user_idx').on(table.userId),
  endpointIdx: uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint),
}));
```

### Notification Service

```typescript
// services/notification-service.ts

import { db } from '@/db';
import { notifications, notificationPreferences, pushSubscriptions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { EmailService } from './email-service';
import { TwilioService } from './twilio-service';
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  'mailto:support@yourdomain.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface NotificationPayload {
  userId: string;
  type: string;
  category: 'transactional' | 'marketing' | 'security';
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  data?: Record<string, any>;
  channels?: ('email' | 'sms' | 'push' | 'inApp')[];
}

interface NotificationTemplate {
  type: string;
  category: 'transactional' | 'marketing' | 'security';
  title: (data: any) => string;
  body: (data: any) => string;
  emailTemplate?: string;
  smsTemplate?: (data: any) => string;
}

// Notification templates
const templates: Record<string, NotificationTemplate> = {
  booking_confirmed: {
    type: 'booking_confirmed',
    category: 'transactional',
    title: (data) => 'Booking Confirmed',
    body: (data) => `Your booking for ${data.serviceName} on ${data.date} has been confirmed.`,
    emailTemplate: 'booking-confirmed',
    smsTemplate: (data) => `Your booking for ${data.serviceName} on ${data.date} is confirmed. View details: ${data.url}`,
  },
  payment_received: {
    type: 'payment_received',
    category: 'transactional',
    title: (data) => 'Payment Received',
    body: (data) => `We received your payment of $${data.amount}.`,
    emailTemplate: 'payment-received',
  },
  new_message: {
    type: 'new_message',
    category: 'transactional',
    title: (data) => `New message from ${data.senderName}`,
    body: (data) => data.preview,
    smsTemplate: (data) => `New message from ${data.senderName}: "${data.preview}" Reply at: ${data.url}`,
  },
  security_alert: {
    type: 'security_alert',
    category: 'security',
    title: (data) => 'Security Alert',
    body: (data) => data.message,
    emailTemplate: 'security-alert',
    smsTemplate: (data) => `Security alert: ${data.message}`,
  },
};

export class NotificationService {
  /**
   * Send notification using template
   */
  static async sendFromTemplate(
    userId: string,
    templateId: string,
    data: Record<string, any>,
    channels?: ('email' | 'sms' | 'push' | 'inApp')[]
  ) {
    const template = templates[templateId];
    if (!template) {
      throw new Error(`Unknown notification template: ${templateId}`);
    }

    return this.send({
      userId,
      type: template.type,
      category: template.category,
      title: template.title(data),
      body: template.body(data),
      data,
      channels,
    });
  }

  /**
   * Send notification to user
   */
  static async send(payload: NotificationPayload) {
    const { userId, channels } = payload;

    // Get user preferences
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // Default preferences if not set
    const preferences = prefs || {
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      inAppEnabled: true,
      marketingEnabled: true,
      transactionalEnabled: true,
      securityEnabled: true,
    };

    // Check if category is enabled
    const categoryEnabled = 
      (payload.category === 'transactional' && preferences.transactionalEnabled) ||
      (payload.category === 'marketing' && preferences.marketingEnabled) ||
      (payload.category === 'security' && preferences.securityEnabled);

    if (!categoryEnabled) {
      return null;
    }

    // Check quiet hours
    if (prefs?.quietHoursEnabled && payload.category !== 'security') {
      const isQuietHours = this.isInQuietHours(
        prefs.quietHoursStart!,
        prefs.quietHoursEnd!,
        prefs.timezone!
      );
      if (isQuietHours) {
        // Queue for later or skip
        return null;
      }
    }

    // Create in-app notification
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: payload.userId,
        type: payload.type,
        category: payload.category,
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
        data: payload.data,
      })
      .returning();

    // Determine which channels to use
    const enabledChannels = channels || ['email', 'sms', 'push', 'inApp'];

    // Send to each enabled channel
    const results = {
      inApp: true,
      email: false,
      sms: false,
      push: false,
    };

    // Email
    if (enabledChannels.includes('email') && preferences.emailEnabled) {
      try {
        await this.sendEmail(userId, payload);
        results.email = true;
        await db
          .update(notifications)
          .set({ emailSent: true, emailSentAt: new Date() })
          .where(eq(notifications.id, notification.id));
      } catch (error) {
        console.error('Email notification failed:', error);
      }
    }

    // SMS
    if (enabledChannels.includes('sms') && preferences.smsEnabled) {
      try {
        await this.sendSMS(userId, payload);
        results.sms = true;
        await db
          .update(notifications)
          .set({ smsSent: true, smsSentAt: new Date() })
          .where(eq(notifications.id, notification.id));
      } catch (error) {
        console.error('SMS notification failed:', error);
      }
    }

    // Push
    if (enabledChannels.includes('push') && preferences.pushEnabled) {
      try {
        await this.sendPush(userId, payload);
        results.push = true;
        await db
          .update(notifications)
          .set({ pushSent: true, pushSentAt: new Date() })
          .where(eq(notifications.id, notification.id));
      } catch (error) {
        console.error('Push notification failed:', error);
      }
    }

    return { notification, results };
  }

  /**
   * Send email notification
   */
  private static async sendEmail(userId: string, payload: NotificationPayload) {
    const user = await this.getUser(userId);
    if (!user?.email) return;

    const template = templates[payload.type];
    
    await EmailService.send({
      to: user.email,
      template: template?.emailTemplate || 'notification',
      variables: {
        name: user.name,
        title: payload.title,
        body: payload.body,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
        ...payload.data,
      },
    });
  }

  /**
   * Send SMS notification
   */
  private static async sendSMS(userId: string, payload: NotificationPayload) {
    const user = await this.getUser(userId);
    if (!user?.phone) return;

    const template = templates[payload.type];
    const message = template?.smsTemplate 
      ? template.smsTemplate(payload.data)
      : `${payload.title}: ${payload.body}`;

    await TwilioService.sendSMS({
      to: user.phone,
      body: message,
    });
  }

  /**
   * Send push notification
   */
  private static async sendPush(userId: string, payload: NotificationPayload) {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      image: payload.imageUrl,
      data: {
        url: payload.actionUrl,
        ...payload.data,
      },
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            pushPayload
          );
        } catch (error: any) {
          // Remove invalid subscriptions
          if (error.statusCode === 410) {
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id));
          }
        }
      })
    );
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ) {
    const conditions = [eq(notifications.userId, userId)];
    
    if (options?.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(options?.limit || 50);
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string) {
    return db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      );
  }

  /**
   * Mark all as read
   */
  static async markAllAsRead(userId: string) {
    return db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    
    return result.count;
  }

  /**
   * Check if current time is in quiet hours
   */
  private static isInQuietHours(
    start: string,
    end: string,
    timezone: string
  ): boolean {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    
    const currentTime = formatter.format(now);
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    
    return currentTime >= start && currentTime < end;
  }

  /**
   * Get user helper
   */
  private static async getUser(userId: string) {
    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    
    return user;
  }
}
```


---


---

# PART 30: SEARCH IMPLEMENTATION

## 🔍 FULL-TEXT SEARCH PATTERNS

Complete search implementation with Postgres full-text search and optional Algolia integration.

### Postgres Full-Text Search

```typescript
// lib/search/postgres-search.ts

import { db } from '@/db';
import { sql } from 'drizzle-orm';

interface SearchOptions {
  query: string;
  table: string;
  searchColumns: string[];
  selectColumns?: string[];
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  orderBy?: 'relevance' | 'newest' | 'oldest';
}

interface SearchResult<T> {
  data: T[];
  total: number;
  query: string;
  took: number; // milliseconds
}

export class PostgresSearch {
  /**
   * Full-text search with ranking
   */
  static async search<T>(options: SearchOptions): Promise<SearchResult<T>> {
    const startTime = Date.now();
    const {
      query,
      table,
      searchColumns,
      selectColumns = ['*'],
      limit = 20,
      offset = 0,
      filters = {},
      orderBy = 'relevance',
    } = options;

    // Build search vector
    const searchVector = searchColumns
      .map((col) => `coalesce(${col}, '')`)
      .join(" || ' ' || ");

    // Build tsquery from user input
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .map((term) => `${term}:*`)
      .join(' & ');

    // Build filter conditions
    const filterConditions = Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key} = '${value}'`)
      .join(' AND ');

    const whereClause = filterConditions
      ? `WHERE ${filterConditions} AND to_tsvector('english', ${searchVector}) @@ to_tsquery('english', '${tsQuery}')`
      : `WHERE to_tsvector('english', ${searchVector}) @@ to_tsquery('english', '${tsQuery}')`;

    // Order by clause
    let orderClause = '';
    switch (orderBy) {
      case 'relevance':
        orderClause = `ORDER BY ts_rank(to_tsvector('english', ${searchVector}), to_tsquery('english', '${tsQuery}')) DESC`;
        break;
      case 'newest':
        orderClause = 'ORDER BY created_at DESC';
        break;
      case 'oldest':
        orderClause = 'ORDER BY created_at ASC';
        break;
    }

    // Execute search query
    const dataQuery = `
      SELECT ${selectColumns.join(', ')},
             ts_rank(to_tsvector('english', ${searchVector}), to_tsquery('english', '${tsQuery}')) as relevance
      FROM ${table}
      ${whereClause}
      ${orderClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${table}
      ${whereClause}
    `;

    const [data, countResult] = await Promise.all([
      db.execute(sql.raw(dataQuery)),
      db.execute(sql.raw(countQuery)),
    ]);

    const took = Date.now() - startTime;

    return {
      data: data.rows as T[],
      total: Number(countResult.rows[0]?.total || 0),
      query,
      took,
    };
  }

  /**
   * Autocomplete/suggest search
   */
  static async suggest(
    query: string,
    table: string,
    column: string,
    limit: number = 10
  ): Promise<string[]> {
    const result = await db.execute(sql.raw(`
      SELECT DISTINCT ${column}
      FROM ${table}
      WHERE ${column} ILIKE '${query}%'
      ORDER BY ${column}
      LIMIT ${limit}
    `));

    return result.rows.map((row: any) => row[column]);
  }

  /**
   * Create search index (run once during setup)
   */
  static async createSearchIndex(
    table: string,
    columns: string[],
    indexName: string
  ): Promise<void> {
    const vector = columns
      .map((col) => `coalesce(${col}, '')`)
      .join(" || ' ' || ");

    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS ${indexName}
      ON ${table}
      USING GIN (to_tsvector('english', ${vector}))
    `));
  }
}
```

### Search API Endpoint

```typescript
// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { PostgresSearch } from '@/lib/search/postgres-search';

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['all', 'products', 'users', 'posts']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const params = searchSchema.parse(Object.fromEntries(searchParams));
    const { q, type, page, limit } = params;

    const offset = (page - 1) * limit;
    const results: Record<string, any> = {};

    // Search products
    if (type === 'all' || type === 'products') {
      results.products = await PostgresSearch.search({
        query: q,
        table: 'products',
        searchColumns: ['name', 'description', 'category'],
        selectColumns: ['id', 'name', 'description', 'price', 'image_url', 'slug'],
        limit: type === 'all' ? 5 : limit,
        offset: type === 'all' ? 0 : offset,
        filters: { is_active: true },
      });
    }

    // Search users (for admin)
    if (type === 'all' || type === 'users') {
      results.users = await PostgresSearch.search({
        query: q,
        table: 'profiles',
        searchColumns: ['name', 'email'],
        selectColumns: ['id', 'name', 'email', 'avatar_url'],
        limit: type === 'all' ? 5 : limit,
        offset: type === 'all' ? 0 : offset,
      });
    }

    // Search posts
    if (type === 'all' || type === 'posts') {
      results.posts = await PostgresSearch.search({
        query: q,
        table: 'posts',
        searchColumns: ['title', 'content', 'excerpt'],
        selectColumns: ['id', 'title', 'excerpt', 'slug', 'published_at'],
        limit: type === 'all' ? 5 : limit,
        offset: type === 'all' ? 0 : offset,
        filters: { status: 'published' },
      });
    }

    return NextResponse.json({
      query: q,
      results,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', code: 'SEARCH_ERROR' },
      { status: 500 }
    );
  }
}
```

### Search UI Component

```typescript
// components/search/global-search.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from '@/components/ui/command';
import { 
  Search, 
  Package, 
  User, 
  FileText, 
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'product' | 'user' | 'post';
  url: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const debouncedQuery = useDebounce(query, 300);

  // Keyboard shortcut to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}&type=all`
        );
        
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        
        // Flatten results
        const flatResults: SearchResult[] = [];
        
        if (data.results.products?.data) {
          data.results.products.data.forEach((item: any) => {
            flatResults.push({
              id: item.id,
              title: item.name,
              subtitle: `$${item.price}`,
              type: 'product',
              url: `/products/${item.slug}`,
            });
          });
        }
        
        if (data.results.users?.data) {
          data.results.users.data.forEach((item: any) => {
            flatResults.push({
              id: item.id,
              title: item.name || item.email,
              subtitle: item.email,
              type: 'user',
              url: `/admin/users/${item.id}`,
            });
          });
        }
        
        if (data.results.posts?.data) {
          data.results.posts.data.forEach((item: any) => {
            flatResults.push({
              id: item.id,
              title: item.title,
              subtitle: item.excerpt?.slice(0, 50) + '...',
              type: 'post',
              url: `/blog/${item.slug}`,
            });
          });
        }
        
        setResults(flatResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const handleSelect = useCallback((url: string) => {
    setOpen(false);
    setQuery('');
    router.push(url);
  }, [router]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'product':
        return Package;
      case 'user':
        return User;
      case 'post':
        return FileText;
      default:
        return Search;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border rounded-lg hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search products, users, posts..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <CommandLoading>
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            </CommandLoading>
          )}
          
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!isLoading && results.length > 0 && (
            <>
              {/* Products */}
              {results.filter(r => r.type === 'product').length > 0 && (
                <CommandGroup heading="Products">
                  {results
                    .filter(r => r.type === 'product')
                    .map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result.url)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              )}

              {/* Users */}
              {results.filter(r => r.type === 'user').length > 0 && (
                <CommandGroup heading="Users">
                  {results
                    .filter(r => r.type === 'user')
                    .map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result.url)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              )}

              {/* Posts */}
              {results.filter(r => r.type === 'post').length > 0 && (
                <CommandGroup heading="Posts">
                  {results
                    .filter(r => r.type === 'post')
                    .map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result.url)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

---


---

# PART 31: REAL-TIME PATTERNS

## ⚡ SUPABASE REALTIME INTEGRATION

Complete real-time functionality using Supabase Realtime.

### Real-time Hook

```typescript
// hooks/use-realtime.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeOptions<T> {
  table: string;
  schema?: string;
  event?: ChangeEvent | '*';
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: { old: T; new: T }) => void;
  onDelete?: (payload: T) => void;
}

export function useRealtime<T extends Record<string, any>>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const supabase = createClient();

    const channelConfig: any = {
      event,
      schema,
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const newChannel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        channelConfig,
        (payload: RealtimePostgresChangesPayload<T>) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new as T);
              break;
            case 'UPDATE':
              onUpdate?.({
                old: payload.old as T,
                new: payload.new as T,
              });
              break;
            case 'DELETE':
              onDelete?.(payload.old as T);
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('disconnected');
        }
      });

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [table, schema, event, filter, onInsert, onUpdate, onDelete]);

  const unsubscribe = useCallback(() => {
    if (channel) {
      const supabase = createClient();
      supabase.removeChannel(channel);
      setStatus('disconnected');
    }
  }, [channel]);

  return { status, unsubscribe };
}
```

### Real-time List Hook

```typescript
// hooks/use-realtime-list.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealtime } from './use-realtime';

interface UseRealtimeListOptions<T> {
  table: string;
  initialData: T[];
  filter?: string;
  idField?: keyof T;
}

export function useRealtimeList<T extends Record<string, any>>({
  table,
  initialData,
  filter,
  idField = 'id' as keyof T,
}: UseRealtimeListOptions<T>) {
  const [items, setItems] = useState<T[]>(initialData);

  // Reset when initial data changes
  useEffect(() => {
    setItems(initialData);
  }, [initialData]);

  const handleInsert = useCallback((newItem: T) => {
    setItems((prev) => [newItem, ...prev]);
  }, []);

  const handleUpdate = useCallback(
    ({ new: updatedItem }: { old: T; new: T }) => {
      setItems((prev) =>
        prev.map((item) =>
          item[idField] === updatedItem[idField] ? updatedItem : item
        )
      );
    },
    [idField]
  );

  const handleDelete = useCallback(
    (deletedItem: T) => {
      setItems((prev) =>
        prev.filter((item) => item[idField] !== deletedItem[idField])
      );
    },
    [idField]
  );

  const { status } = useRealtime<T>({
    table,
    filter,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  });

  return { items, status };
}
```

### Real-time Chat Implementation

```typescript
// components/chat/realtime-chat.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeList } from '@/hooks/use-realtime-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    name: string;
    avatar_url: string;
  };
}

interface RealtimeChatProps {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
}

export function RealtimeChat({
  conversationId,
  currentUserId,
  initialMessages,
}: RealtimeChatProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Real-time messages
  const { items: messages, status } = useRealtimeList<Message>({
    table: 'messages',
    initialData: initialMessages,
    filter: `conversation_id=eq.${conversationId}`,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    const content = message.trim();
    setMessage('');

    try {
      const supabase = createClient();
      
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
      });

      if (error) throw error;

      // Focus input after sending
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessage(content); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg">
      {/* Status indicator */}
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'connected'
              ? 'bg-green-500'
              : status === 'connecting'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-muted-foreground">
          {status === 'connected'
            ? 'Live'
            : status === 'connecting'
            ? 'Connecting...'
            : 'Disconnected'}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={msg.sender?.avatar_url} />
                  <AvatarFallback>
                    {msg.sender?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[300px] ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={isSending || !message.trim()}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Real-time Presence

```typescript
// hooks/use-presence.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  id: string;
  name: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'busy';
  lastSeen?: string;
}

interface UsePresenceOptions {
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

export function usePresence({
  roomId,
  userId,
  userName,
  userAvatar,
}: UsePresenceOptions) {
  const [presences, setPresences] = useState<PresenceState[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const newChannel = supabase.channel(`presence:${roomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    newChannel
      .on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState<PresenceState>();
        const presenceList = Object.values(state)
          .flat()
          .filter((p) => p.id !== userId);
        setPresences(presenceList);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await newChannel.track({
            id: userId,
            name: userName,
            avatarUrl: userAvatar,
            status: 'online',
            lastSeen: new Date().toISOString(),
          });
        }
      });

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [roomId, userId, userName, userAvatar]);

  const updateStatus = async (status: PresenceState['status']) => {
    if (channel) {
      await channel.track({
        id: userId,
        name: userName,
        avatarUrl: userAvatar,
        status,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  return { presences, updateStatus };
}
```

---


---

# PART 42: REAL-TIME FEATURES

## Supabase Realtime

```typescript
// hooks/use-realtime.ts
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseRealtimeOptions<T> {
  table: string;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { id: string }) => void;
}

export function useRealtime<T extends { id: string }>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  useEffect(() => {
    const supabase = createClient();
    
    let channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table,
          filter,
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new as T);
              break;
            case 'UPDATE':
              onUpdate?.(payload.new as T);
              break;
            case 'DELETE':
              onDelete?.(payload.old as { id: string });
              break;
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, onInsert, onUpdate, onDelete]);
}
```

## Usage Example

```typescript
// components/live-notifications.tsx
'use client';

import { useState } from 'react';
import { useRealtime } from '@/hooks/use-realtime';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function LiveNotifications({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useRealtime<Notification>({
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
    onInsert: (notification) => {
      setNotifications(prev => [notification, ...prev]);
      toast(notification.title, { description: notification.message });
    },
    onUpdate: (notification) => {
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? notification : n)
      );
    },
    onDelete: ({ id }) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    },
  });
  
  return (
    <div>
      {notifications.map(n => (
        <div key={n.id} className={n.read ? 'opacity-50' : ''}>
          <p className="font-medium">{n.title}</p>
          <p className="text-sm text-muted-foreground">{n.message}</p>
        </div>
      ))}
    </div>
  );
}
```

---


---

# PART 43: SEARCH IMPLEMENTATION

## Full-Text Search with Postgres

```sql
-- Add search vector column
ALTER TABLE products ADD COLUMN search_vector tsvector;

-- Create index
CREATE INDEX products_search_idx ON products USING GIN (search_vector);

-- Update function
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER products_search_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_search_vector();
```

```typescript
// services/search-service.ts
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export class SearchService {
  static async searchProducts(query: string, options: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  } = {}) {
    const { category, minPrice, maxPrice, limit = 20, offset = 0 } = options;
    
    // Sanitize query
    const sanitizedQuery = query.trim().split(/\s+/).join(' & ');
    
    let whereClause = sql`search_vector @@ to_tsquery('english', ${sanitizedQuery})`;
    
    if (category) {
      whereClause = sql`${whereClause} AND category = ${category}`;
    }
    if (minPrice !== undefined) {
      whereClause = sql`${whereClause} AND price >= ${minPrice}`;
    }
    if (maxPrice !== undefined) {
      whereClause = sql`${whereClause} AND price <= ${maxPrice}`;
    }
    
    const results = await db.execute(sql`
      SELECT 
        id, name, description, price, category, image_url,
        ts_rank(search_vector, to_tsquery('english', ${sanitizedQuery})) as rank
      FROM products
      WHERE ${whereClause}
      ORDER BY rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);
    
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM products
      WHERE ${whereClause}
    `);
    
    return {
      items: results.rows,
      total: Number(countResult.rows[0].total),
      hasMore: offset + results.rows.length < Number(countResult.rows[0].total),
    };
  }
}
```

## Search API

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/services/search-service';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20).max(100),
});

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { q, category, minPrice, maxPrice, page, limit } = searchSchema.parse(params);
    
    const results = await SearchService.searchProducts(q, {
      category,
      minPrice,
      maxPrice,
      limit,
      offset: (page - 1) * limit,
    });
    
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid search parameters' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

---


---

# PART 47: NOTIFICATION SYSTEM

## Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'info', 'success', 'warning', 'error'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications(user_id);
CREATE INDEX notifications_unread_idx ON notifications(user_id, read) WHERE read = FALSE;
```

## Notification Service

```typescript
// services/notification-service.ts
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export class NotificationService {
  static async create(data: {
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    link?: string;
  }) {
    const [notification] = await db
      .insert(notifications)
      .values(data)
      .returning();
    
    return notification;
  }
  
  static async getForUser(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const { limit = 20, unreadOnly = false } = options;
    
    let query = db
      .select()
      .from(notifications)
      .where(
        unreadOnly
          ? and(eq(notifications.userId, userId), eq(notifications.read, false))
          : eq(notifications.userId, userId)
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    
    return query;
  }
  
  static async markAsRead(notificationId: string, userId: string) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }
  
  static async markAllAsRead(userId: string) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }
  
  static async getUnreadCount(userId: string) {
    const [result] = await db
      .select({ count: sql`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
    
    return Number(result.count);
  }
}
```

## Notification Bell Component

```typescript
// components/notification-bell.tsx
'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then(r => r.json()),
  });
  
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => fetch('/api/notifications/unread-count').then(r => r.json()),
  });
  
  const markAsRead = useMutation({
    mutationFn: (id: string) => fetch(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  const markAllAsRead = useMutation({
    mutationFn: () => fetch('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => markAllAsRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">
              No notifications
            </p>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={cn(
                  'p-4 border-b hover:bg-muted cursor-pointer',
                  !n.read && 'bg-primary/5'
                )}
                onClick={() => {
                  markAsRead.mutate(n.id);
                  if (n.link) window.location.href = n.link;
                }}
              >
                <p className="font-medium text-sm">{n.title}</p>
                {n.message && (
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

