# Rate Limiting

> Copy-paste ready. Protect API routes from abuse.

## Dependencies
```bash
npm install @upstash/ratelimit @upstash/redis
```

## Code

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create rate limiter - 10 requests per 10 seconds
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
});

// Helper to get identifier
export function getIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'anonymous';
  return ip;
}
```

```typescript
// app/api/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ratelimit, getIdentifier } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Check rate limit
    const identifier = getIdentifier(req);
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }

    // Your logic here...

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Environment Variables
```bash
# .env.local
UPSTASH_REDIS_REST_URL=your_url
UPSTASH_REDIS_REST_TOKEN=your_token
```

## Test

```typescript
// app/api/send/route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  ratelimit: {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 10000
    }),
  },
  getIdentifier: vi.fn().mockReturnValue('test-ip'),
}));

describe('POST /api/send', () => {
  it('allows request within rate limit', async () => {
    const req = new Request('http://test/api/send', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });
});
```

## Usage
Add rate limiting to any public-facing API, especially auth endpoints and form submissions.
