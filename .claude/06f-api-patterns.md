# UNKNOWN API INTEGRATION PROTOCOL
# Module: 06f-api-patterns.md
# Load with: 00-core.md
# Covers: Learning new APIs on the fly, generic API client patterns

---

## LEARN ANY API ON THE FLY

When Claude encounters an API not covered in pattern files, follow this protocol to learn and integrate it.

### Trigger Conditions
- User mentions an unfamiliar service/API
- User asks to integrate a tool not in pattern files
- User provides API documentation

### Step 1: Request Documentation

```markdown
## When Encountering Unknown API

If user asks to integrate a service not covered in pattern files, respond:

"I don't have built-in patterns for [Service]. To create a proper integration, please provide ONE of the following:

1. **API Documentation URL** - Link to their API docs
2. **OpenAPI/Swagger Spec** - JSON or YAML specification
3. **Example Code** - Sample requests/responses from their docs
4. **Postman Collection** - If available

I'll analyze the API and generate:
- Client setup with proper authentication
- Service class following our patterns
- Webhook handlers (if applicable)
- TypeScript types
- Tests

Which can you provide?"
```

### Step 2: Analyze Documentation

When documentation is provided, extract:

```typescript
// API Analysis Template
interface APIAnalysis {
  // Basic Info
  name: string;
  baseUrl: string;
  version: string;

  // Authentication
  auth: {
    type: 'apiKey' | 'bearer' | 'oauth2' | 'basic' | 'custom';
    location: 'header' | 'query' | 'body';
    keyName?: string;
    oauthFlow?: 'authorizationCode' | 'clientCredentials' | 'implicit';
    scopes?: string[];
  };

  // Endpoints
  endpoints: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    description: string;
    parameters: {
      name: string;
      type: string;
      required: boolean;
      location: 'path' | 'query' | 'body' | 'header';
    }[];
    responseShape: object;
  }[];

  // Webhooks
  webhooks?: {
    events: string[];
    signatureVerification: boolean;
    signatureHeader?: string;
    signatureAlgorithm?: string;
  };

  // Rate Limits
  rateLimits?: {
    requests: number;
    window: string;
    headers?: {
      limit: string;
      remaining: string;
      reset: string;
    };
  };

  // Pagination
  pagination?: {
    type: 'cursor' | 'offset' | 'page';
    parameters: string[];
  };
}
```

### Step 3: Generate Client

```typescript
// Template: lib/[service]/client.ts

// =============================================================================
// [SERVICE NAME] API CLIENT
// Generated from documentation analysis
// =============================================================================

const API_BASE_URL = process.env.[SERVICE]_API_URL || '[default-url]';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class [Service]APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = '[Service]APIError';
  }
}

export async function [service]Request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Add authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // AUTH PATTERN DEPENDS ON API TYPE:

    // API Key in header:
    'X-API-Key': process.env.[SERVICE]_API_KEY!,

    // Bearer token:
    // 'Authorization': `Bearer ${process.env.[SERVICE]_API_KEY}`,

    // Basic auth:
    // 'Authorization': `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,

    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new [Service]APIError(
      'Rate limit exceeded',
      429,
      'RATE_LIMITED',
      { retryAfter }
    );
  }

  // Handle errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new [Service]APIError(
      error.message || `API error: ${response.status}`,
      response.status,
      error.code,
      error
    );
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Export error class for handling
export { [Service]APIError };
```

### Step 4: Generate Service Class

```typescript
// Template: services/[service]-service.ts

// =============================================================================
// [SERVICE NAME] SERVICE
// Generated from documentation analysis
// =============================================================================

import { [service]Request, [Service]APIError } from '@/lib/[service]/client';

// Types generated from API response shapes
interface [Resource] {
  id: string;
  // ... fields from API
}

interface Create[Resource]Params {
  // ... fields for creation
}

interface List[Resources]Params {
  limit?: number;
  cursor?: string;
  // ... other filter params
}

interface List[Resources]Response {
  data: [Resource][];
  hasMore: boolean;
  nextCursor?: string;
}

export class [Service]Service {
  /**
   * List [resources]
   */
  static async list(params?: List[Resources]Params): Promise<List[Resources]Response> {
    return [service]Request<List[Resources]Response>('/[resources]', {
      params: params as Record<string, string>,
    });
  }

  /**
   * Get [resource] by ID
   */
  static async getById(id: string): Promise<[Resource]> {
    return [service]Request<[Resource]>(`/[resources]/${id}`);
  }

  /**
   * Create [resource]
   */
  static async create(data: Create[Resource]Params): Promise<[Resource]> {
    return [service]Request<[Resource]>('/[resources]', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update [resource]
   */
  static async update(id: string, data: Partial<Create[Resource]Params>): Promise<[Resource]> {
    return [service]Request<[Resource]>(`/[resources]/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete [resource]
   */
  static async delete(id: string): Promise<void> {
    await [service]Request<void>(`/[resources]/${id}`, {
      method: 'DELETE',
    });
  }
}
```

### Step 5: Generate Webhook Handler

```typescript
// Template: app/api/webhooks/[service]/route.ts

// =============================================================================
// [SERVICE NAME] WEBHOOK HANDLER
// Generated from documentation analysis
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Signature verification (adjust based on API's method)
function verifySignature(payload: string, signature: string): boolean {
  // HMAC-SHA256 (most common)
  const expectedSignature = crypto
    .createHmac('sha256', process.env.[SERVICE]_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = headers();

  // Get signature header (name varies by service)
  const signature = headersList.get('x-[service]-signature')
    || headersList.get('x-webhook-signature')
    || headersList.get('[service]-signature');

  // Verify signature
  if (process.env.[SERVICE]_WEBHOOK_SECRET && signature) {
    const isValid = verifySignature(body, signature);
    if (!isValid) {
      console.error('[Service] webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const payload = JSON.parse(body);

  // Extract event type (structure varies by API)
  const eventType = payload.type || payload.event || payload.eventType;
  const eventData = payload.data || payload.payload || payload;

  try {
    switch (eventType) {
      case '[event.type.1]':
        await handle[Event1](eventData);
        break;

      case '[event.type.2]':
        await handle[Event2](eventData);
        break;

      default:
        console.log(`Unhandled [Service] event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Service] webhook error:', error);
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// Event handlers
async function handle[Event1](data: any) {
  // Process event
}

async function handle[Event2](data: any) {
  // Process event
}
```

### Step 6: Generate Environment Variables

```env
# [SERVICE NAME] Integration
# Generated from documentation analysis

[SERVICE]_API_KEY=
[SERVICE]_API_URL=https://api.[service].com/v1
[SERVICE]_WEBHOOK_SECRET=

# OAuth (if applicable)
[SERVICE]_CLIENT_ID=
[SERVICE]_CLIENT_SECRET=
[SERVICE]_REDIRECT_URI=http://localhost:3000/api/auth/[service]/callback
```

### Step 7: Report Generation

After generating the integration, report:

```markdown
## Integration Generated: [Service Name]

**From:** [Documentation source]

**Generated Files:**
- `lib/[service]/client.ts` - API client with auth
- `services/[service]-service.ts` - Service class with CRUD
- `app/api/webhooks/[service]/route.ts` - Webhook handler
- `types/[service].ts` - TypeScript types
- `.env.example` updated with required variables

**Authentication:** [Type detected]
**Endpoints Covered:** [X] endpoints
**Webhook Events:** [X] events

**Environment Variables Needed:**
```
[SERVICE]_API_KEY=your-api-key
[SERVICE]_WEBHOOK_SECRET=your-webhook-secret
```

**Usage Example:**
```typescript
import { [Service]Service } from '@/services/[service]-service';

// List resources
const items = await [Service]Service.list({ limit: 20 });

// Create resource
const newItem = await [Service]Service.create({ name: 'Test' });
```

**Ready to test? Say "test the [service] integration"**
```

---

## GENERIC API CLIENT TEMPLATE

For quick integrations without full service class:

```typescript
// lib/api-client.ts
export function createAPIClient(config: {
  baseUrl: string;
  apiKey: string;
  authType: 'bearer' | 'apiKey' | 'basic';
  apiKeyHeader?: string;
}) {
  return async function request<T>(
    endpoint: string,
    options: RequestInit & { params?: Record<string, string> } = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${config.baseUrl}${endpoint}`;
    if (params) {
      url += `?${new URLSearchParams(params).toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    switch (config.authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      case 'apiKey':
        headers[config.apiKeyHeader || 'X-API-Key'] = config.apiKey;
        break;
      case 'basic':
        headers['Authorization'] = `Basic ${Buffer.from(config.apiKey).toString('base64')}`;
        break;
    }

    const response = await fetch(url, { ...fetchOptions, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  };
}

// Usage:
const acmeApi = createAPIClient({
  baseUrl: 'https://api.acme.com/v1',
  apiKey: process.env.ACME_API_KEY!,
  authType: 'bearer',
});

const users = await acmeApi<User[]>('/users', { params: { limit: '10' } });
```

---
