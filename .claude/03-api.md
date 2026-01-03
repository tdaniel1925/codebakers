# API DEVELOPMENT
# Module: 03-api.md
# Load with: 00-core.md

---

# PART 6: API DEVELOPMENT

## 🔌 API ROUTE PATTERNS

### Standard API Route Structure

```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { resources } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Validation schemas
const createResourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateResourceSchema = createResourceSchema.partial();

// Standardized error response
function errorResponse(
  message: string,
  code: string,
  status: number,
  details?: Record<string, string[]>
) {
  return NextResponse.json(
    { error: message, code, details },
    { status }
  );
}

// GET - List resources
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Fetch data
    const data = await db
      .select()
      .from(resources)
      .where(eq(resources.userId, user.id))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resources)
      .where(eq(resources.userId, user.id));

    return NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });

  } catch (error) {
    console.error('GET /api/resources error:', error);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

// POST - Create resource
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Parse and validate body
    const body = await req.json();
    const result = createResourceSchema.safeParse(body);
    
    if (!result.success) {
      return errorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        400,
        result.error.flatten().fieldErrors
      );
    }

    // Create resource
    const [resource] = await db
      .insert(resources)
      .values({
        ...result.data,
        userId: user.id,
      })
      .returning();

    return NextResponse.json({ data: resource }, { status: 201 });

  } catch (error) {
    console.error('POST /api/resources error:', error);
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
```

### Dynamic Route with ID

```typescript
// app/api/[resource]/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { resources } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

type RouteParams = {
  params: { id: string };
};

// GET - Get single resource
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const [resource] = await db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, params.id),
          eq(resources.userId, user.id)
        )
      )
      .limit(1);

    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: resource });

  } catch (error) {
    console.error(`GET /api/resources/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// PATCH - Update resource
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = updateResourceSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          code: 'VALIDATION_ERROR',
          details: result.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    // Check ownership
    const [existing] = await db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, params.id),
          eq(resources.userId, user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Resource not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Update
    const [updated] = await db
      .update(resources)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(resources.id, params.id))
      .returning();

    return NextResponse.json({ data: updated });

  } catch (error) {
    console.error(`PATCH /api/resources/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE - Delete resource
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Check ownership
    const [existing] = await db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, params.id),
          eq(resources.userId, user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Resource not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Delete
    await db.delete(resources).where(eq(resources.id, params.id));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(`DELETE /api/resources/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### Webhook Handler Pattern

```typescript
// app/api/webhooks/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Verify webhook signature
function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    const headersList = headers();
    const signature = headersList.get('x-webhook-signature');
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature', code: 'MISSING_SIGNATURE' },
        { status: 401 }
      );
    }

    const body = await req.text();
    const isValid = verifySignature(
      body,
      signature,
      process.env.WEBHOOK_SECRET!
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);
    const { event, data } = payload;

    // Handle different event types
    switch (event) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(data);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to prevent retries for processing errors
    // Log the error for investigation
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Event handlers
async function handleUserCreated(data: any) {
  // Implementation
}

async function handlePaymentCompleted(data: any) {
  // Implementation
}

async function handleSubscriptionUpdated(data: any) {
  // Implementation
}
```

---


---

# PART 52: RATE LIMITING

## Rate Limiter

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different rate limiters for different purposes
export const rateLimiters = {
  // General API: 100 requests per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  
  // Auth endpoints: 10 requests per minute
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  
  // File uploads: 20 per hour
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),
  
  // Expensive operations: 5 per minute
  expensive: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'ratelimit:expensive',
  }),
};

export async function rateLimit(
  limiter: keyof typeof rateLimiters,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const result = await rateLimiters[limiter].limit(identifier);
  
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
```

## Rate Limit Middleware

```typescript
// lib/with-rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimiters } from '@/lib/rate-limit';

export function withRateLimit(
  limiter: keyof typeof rateLimiters,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    // Use IP or user ID as identifier
    const identifier = 
      req.headers.get('x-user-id') || 
      req.headers.get('x-forwarded-for') || 
      'anonymous';
    
    const result = await rateLimit(limiter, identifier);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: result.reset },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    const response = await handler(req);
    
    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());
    
    return response;
  };
}

// Usage
export const POST = withRateLimit('auth', async (req) => {
  // Handle login
});
```

---

**This is the Ultimate AI Building Robot.**

**Tell Claude what you want. It builds it, tests it, fixes it.**

---

# END OF CLAUDE.md ENTERPRISE EDITION v11.0

## Total Coverage

| Category | Parts |
|----------|-------|
| Core Standards | 1-3 |
| Auth & Database | 4-5 |
| API & Frontend | 6-7 |
| Integrations | 8-11 |
| Security & Compliance | 12-18 |
| Deployment | 19-22 |
| Generators | 23-25 |
| Self-Healing | 26-27 |
| Advanced Patterns | 28-32 |
| **NEW: Git & Performance** | 33-34 |
| **NEW: Accessibility & SEO** | 35-36 |
| **NEW: Analytics & Monitoring** | 37-38 |
| **NEW: File Uploads & Email** | 39-40 |
| **NEW: Background Jobs & Realtime** | 41-42 |
| **NEW: Search & Pagination** | 43-44 |
| **NEW: Forms & Loading States** | 45-46 |
| **NEW: Notifications & Multi-tenancy** | 47-48 |
| **NEW: Audit Logs & Feature Flags** | 49-50 |
| **NEW: Data Export & Rate Limiting** | 51-52 |

---

**52 Parts. Complete SaaS Coverage. Production-Ready Patterns.**

---


---

# PART 55: API VERSIONING

## URL-Based Versioning (Recommended)

```typescript
// app/api/v1/users/route.ts
export async function GET() {
  // V1 implementation
}

// app/api/v2/users/route.ts  
export async function GET() {
  // V2 implementation with breaking changes
}
```

## Version Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

const CURRENT_VERSION = 'v2';
const SUPPORTED_VERSIONS = ['v1', 'v2'];
const DEPRECATED_VERSIONS = ['v1'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if API request
  if (pathname.startsWith('/api/')) {
    const pathParts = pathname.split('/');
    const version = pathParts[2]; // /api/v1/...
    
    // Validate version
    if (version?.startsWith('v') && !SUPPORTED_VERSIONS.includes(version)) {
      return NextResponse.json(
        { 
          error: 'Unsupported API version',
          supported: SUPPORTED_VERSIONS,
          current: CURRENT_VERSION,
        },
        { status: 400 }
      );
    }
    
    // Add deprecation warning header
    if (DEPRECATED_VERSIONS.includes(version)) {
      const response = NextResponse.next();
      response.headers.set(
        'X-API-Deprecation-Warning',
        `API ${version} is deprecated. Please migrate to ${CURRENT_VERSION}`
      );
      response.headers.set('X-API-Deprecation-Date', '2025-06-01');
      return response;
    }
  }
  
  return NextResponse.next();
}
```

## Shared Logic Between Versions

```typescript
// services/user-service.ts
export class UserService {
  // Shared logic
  static async getById(id: string) {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  }
  
  // V1 format
  static formatV1(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
  
  // V2 format (breaking change: split name into firstName/lastName)
  static formatV2(user: User) {
    const [firstName, ...rest] = user.name.split(' ');
    return {
      id: user.id,
      firstName,
      lastName: rest.join(' '),
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

// app/api/v1/users/[id]/route.ts
export async function GET(req, { params }) {
  const user = await UserService.getById(params.id);
  return NextResponse.json(UserService.formatV1(user));
}

// app/api/v2/users/[id]/route.ts
export async function GET(req, { params }) {
  const user = await UserService.getById(params.id);
  return NextResponse.json(UserService.formatV2(user));
}
```

---


---

# PART 57: OUTGOING WEBHOOKS

## Webhook Service

```typescript
// services/webhook-service.ts
import { createHmac } from 'crypto';
import { db } from '@/db';
import { webhookEndpoints, webhookDeliveries } from '@/db/schema';

export class WebhookService {
  /**
   * Send webhook to customer endpoint
   */
  static async send(options: {
    teamId: string;
    event: string;
    payload: Record<string, any>;
  }) {
    const { teamId, event, payload } = options;
    
    // Get team's webhook endpoints
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(and(
        eq(webhookEndpoints.teamId, teamId),
        eq(webhookEndpoints.enabled, true)
      ));
    
    // Send to each endpoint
    const results = await Promise.allSettled(
      endpoints.map(endpoint => this.deliver(endpoint, event, payload))
    );
    
    return results;
  }
  
  /**
   * Deliver webhook to single endpoint
   */
  private static async deliver(
    endpoint: WebhookEndpoint,
    event: string,
    payload: Record<string, any>
  ) {
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });
    
    // Generate signature
    const signature = this.generateSignature(body, endpoint.secret);
    
    const startTime = Date.now();
    let statusCode: number;
    let responseBody: string;
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': new Date().toISOString(),
        },
        body,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });
      
      statusCode = response.status;
      responseBody = await response.text();
    } catch (error) {
      statusCode = 0;
      responseBody = error instanceof Error ? error.message : 'Unknown error';
    }
    
    const duration = Date.now() - startTime;
    const success = statusCode >= 200 && statusCode < 300;
    
    // Log delivery
    await db.insert(webhookDeliveries).values({
      endpointId: endpoint.id,
      event,
      payload: body,
      statusCode,
      responseBody: responseBody.slice(0, 1000),
      duration,
      success,
    });
    
    // Schedule retry if failed
    if (!success) {
      await this.scheduleRetry(endpoint.id, event, payload);
    }
    
    return { success, statusCode, duration };
  }
  
  /**
   * Generate HMAC signature
   */
  private static generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
  
  /**
   * Schedule retry with exponential backoff
   */
  private static async scheduleRetry(
    endpointId: string,
    event: string,
    payload: Record<string, any>,
    attempt: number = 1
  ) {
    if (attempt > 5) return; // Max 5 retries
    
    const delay = Math.pow(2, attempt) * 60 * 1000; // 2, 4, 8, 16, 32 minutes
    
    // Use Inngest or similar for delayed jobs
    await inngest.send({
      name: 'webhook/retry',
      data: { endpointId, event, payload, attempt },
      ts: Date.now() + delay,
    });
  }
}
```

## Webhook Events

```typescript
// lib/webhook-events.ts

export const WEBHOOK_EVENTS = {
  // User events
  'user.created': 'New user signed up',
  'user.updated': 'User profile updated',
  'user.deleted': 'User account deleted',
  
  // Subscription events
  'subscription.created': 'New subscription started',
  'subscription.updated': 'Subscription changed',
  'subscription.cancelled': 'Subscription cancelled',
  
  // Invoice events
  'invoice.created': 'Invoice generated',
  'invoice.paid': 'Invoice paid',
  'invoice.failed': 'Invoice payment failed',
  
  // Custom events
  'project.created': 'New project created',
  'project.completed': 'Project marked complete',
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;
```

---


---

# PART 58: API DOCUMENTATION (OPENAPI)

## Generate OpenAPI Spec

```typescript
// lib/openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

const registry = new OpenAPIRegistry();

// Register schemas
const UserSchema = registry.register(
  'User',
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string().datetime(),
  })
);

const ErrorSchema = registry.register(
  'Error',
  z.object({
    error: z.string(),
    code: z.string().optional(),
  })
);

// Register endpoints
registry.registerPath({
  method: 'get',
  path: '/api/v1/users',
  summary: 'List users',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.array(UserSchema),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/users',
  summary: 'Create user',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            name: z.string().min(2),
            password: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
  },
});

// Generate spec
const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiSpec = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Your API',
    version: '1.0.0',
    description: 'API documentation',
  },
  servers: [
    { url: 'https://api.yourdomain.com', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' },
  ],
  security: [{ bearerAuth: [] }],
});
```

## Serve Swagger UI

```typescript
// app/api/docs/route.ts
import { openApiSpec } from '@/lib/openapi';

export async function GET() {
  return new Response(JSON.stringify(openApiSpec), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// app/docs/page.tsx
'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function DocsPage() {
  return <SwaggerUI url="/api/docs" />;
}
```

---


---

# PART 59: HEALTH CHECKS

## Health Check Endpoint

```typescript
// app/api/health/route.ts
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { redis } from '@/lib/redis';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    external: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return { 
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkExternal(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.stripe.com/v1', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return { 
      status: response.status < 500 ? 'healthy' : 'unhealthy',
      latency: Date.now() - start,
    };
  } catch {
    return { status: 'unhealthy', message: 'Stripe unreachable' };
  }
}

export async function GET() {
  const [database, redisCheck, external] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkExternal(),
  ]);
  
  const checks = { database, redis: redisCheck, external };
  
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');
  
  const health: HealthCheck = {
    status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    checks,
  };
  
  return Response.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  });
}
```

## Liveness & Readiness (Kubernetes)

```typescript
// app/api/health/live/route.ts
// Simple liveness - just checks if app is running
export async function GET() {
  return Response.json({ status: 'alive' });
}

// app/api/health/ready/route.ts
// Readiness - checks if app can handle requests
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: 'ready' });
  } catch {
    return Response.json({ status: 'not ready' }, { status: 503 });
  }
}
```

---


---

# PART 60: CIRCUIT BREAKER PATTERN

## Circuit Breaker Implementation

```typescript
// lib/circuit-breaker.ts

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;  // Failures before opening
  resetTimeout: number;      // Ms before trying again
  monitorInterval: number;   // Ms to track failures
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private options: CircuitBreakerOptions;
  
  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 30000,
      monitorInterval: 60000,
      ...options,
    };
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState() {
    return this.state;
  }
}

// Create circuit breakers for different services
export const circuitBreakers = {
  stripe: new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60000 }),
  email: new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 }),
  ai: new CircuitBreaker({ failureThreshold: 3, resetTimeout: 120000 }),
};
```

## Usage with Fallbacks

```typescript
// services/payment-service.ts
import { circuitBreakers } from '@/lib/circuit-breaker';

export class PaymentService {
  static async createCharge(amount: number, customerId: string) {
    try {
      return await circuitBreakers.stripe.execute(async () => {
        return stripe.charges.create({
          amount,
          currency: 'usd',
          customer: customerId,
        });
      });
    } catch (error) {
      if (error.message === 'Circuit breaker is open') {
        // Fallback: Queue for later processing
        await queuePayment({ amount, customerId });
        return { queued: true };
      }
      throw error;
    }
  }
}
```

---


---

# PART 61: RETRY PATTERNS

## Exponential Backoff with Jitter

```typescript
// lib/retry.ts

interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryOn?: (error: Error) => boolean;
}

const defaultOptions: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry this error
      if (opts.retryOn && !opts.retryOn(lastError)) {
        throw lastError;
      }
      
      // Don't wait after last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      // Calculate delay with exponential backoff
      let delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt - 1),
        opts.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random());
      }
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage
const result = await retry(
  () => fetchExternalApi('/data'),
  {
    maxAttempts: 5,
    baseDelay: 1000,
    retryOn: (error) => {
      // Only retry on network errors or 5xx
      return error.name === 'NetworkError' || 
             (error as any).status >= 500;
    },
  }
);
```

---


---

# PART 62: IDEMPOTENCY

## Idempotency Key Pattern

```typescript
// lib/idempotency.ts
import { redis } from '@/lib/redis';

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours

interface IdempotencyRecord {
  status: 'processing' | 'completed';
  response?: any;
  createdAt: string;
}

export class IdempotencyService {
  /**
   * Check if request already processed
   */
  static async check(key: string): Promise<IdempotencyRecord | null> {
    const data = await redis.get(`idempotency:${key}`);
    return data ? JSON.parse(data) : null;
  }
  
  /**
   * Mark request as processing
   */
  static async start(key: string): Promise<boolean> {
    // SET NX = only set if not exists
    const result = await redis.set(
      `idempotency:${key}`,
      JSON.stringify({ status: 'processing', createdAt: new Date().toISOString() }),
      { nx: true, ex: IDEMPOTENCY_TTL }
    );
    return result === 'OK';
  }
  
  /**
   * Mark request as completed with response
   */
  static async complete(key: string, response: any): Promise<void> {
    await redis.set(
      `idempotency:${key}`,
      JSON.stringify({ 
        status: 'completed', 
        response,
        createdAt: new Date().toISOString(),
      }),
      { ex: IDEMPOTENCY_TTL }
    );
  }
}
```

## Idempotent API Endpoint

```typescript
// app/api/payments/route.ts
import { IdempotencyService } from '@/lib/idempotency';

export async function POST(req: NextRequest) {
  // Get idempotency key from header
  const idempotencyKey = req.headers.get('Idempotency-Key');
  
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Idempotency-Key header required' },
      { status: 400 }
    );
  }
  
  // Check if already processed
  const existing = await IdempotencyService.check(idempotencyKey);
  
  if (existing) {
    if (existing.status === 'processing') {
      return NextResponse.json(
        { error: 'Request is being processed' },
        { status: 409 }
      );
    }
    // Return cached response
    return NextResponse.json(existing.response);
  }
  
  // Mark as processing
  const started = await IdempotencyService.start(idempotencyKey);
  if (!started) {
    return NextResponse.json(
      { error: 'Request is being processed' },
      { status: 409 }
    );
  }
  
  try {
    // Process payment
    const body = await req.json();
    const result = await PaymentService.charge(body);
    
    // Cache response
    await IdempotencyService.complete(idempotencyKey, result);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Don't cache errors - allow retry
    throw error;
  }
}
```

---


---

# PART 106: GRAPHQL PATTERNS

## 🔗 GRAPHQL API & CLIENT

### Schema Definition

```typescript
// src/graphql/schema.ts
import { makeExecutableSchema } from '@graphql-tools/schema';

const typeDefs = `
  type Query {
    user(id: ID!): User
    users(first: Int, after: String): UserConnection!
    me: User
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
  }

  type User {
    id: ID!
    email: String!
    name: String
    posts: [Post!]!
    createdAt: DateTime!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  input CreateUserInput {
    email: String!
    name: String
    password: String!
  }

  input UpdateUserInput {
    name: String
    email: String
  }

  scalar DateTime
`;
```

### Resolvers with Auth

```typescript
// src/graphql/resolvers.ts
import { GraphQLError } from 'graphql';
import { db } from '@/db';
import { users, posts } from '@/db/schema';

const resolvers = {
  Query: {
    me: async (_, __, context) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      return context.user;
    },

    user: async (_, { id }, context) => {
      requireAuth(context);
      return db.query.users.findFirst({
        where: eq(users.id, id),
      });
    },

    users: async (_, { first = 20, after }, context) => {
      requireAuth(context);

      const limit = Math.min(first, 100);
      const cursor = after ? decodeCursor(after) : null;

      const items = await db.query.users.findMany({
        where: cursor ? gt(users.createdAt, cursor) : undefined,
        limit: limit + 1,
        orderBy: asc(users.createdAt),
      });

      const hasNextPage = items.length > limit;
      const edges = items.slice(0, limit).map((user) => ({
        node: user,
        cursor: encodeCursor(user.createdAt),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor: edges[edges.length - 1]?.cursor,
        },
      };
    },
  },

  Mutation: {
    createUser: async (_, { input }, context) => {
      requireAdmin(context);

      const [user] = await db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash: await hashPassword(input.password),
        })
        .returning();

      return user;
    },
  },

  User: {
    posts: async (parent) => {
      return db.query.posts.findMany({
        where: eq(posts.authorId, parent.id),
      });
    },
  },
};

function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}
```

### Client Setup (Apollo)

```typescript
// src/lib/apollo-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: {
            keyArgs: false,
            merge(existing, incoming) {
              return {
                ...incoming,
                edges: [...(existing?.edges || []), ...incoming.edges],
              };
            },
          },
        },
      },
    },
  }),
});
```

### Generated Hooks (with codegen)

```typescript
// src/graphql/hooks.ts (generated)
import { gql, useQuery, useMutation } from '@apollo/client';

export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      email
      name
      posts {
        id
        title
      }
    }
  }
`;

export function useUser(id: string) {
  return useQuery(GET_USER, { variables: { id } });
}

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      email
      name
    }
  }
`;

export function useCreateUser() {
  return useMutation(CREATE_USER, {
    refetchQueries: ['GetUsers'],
  });
}
```

---

