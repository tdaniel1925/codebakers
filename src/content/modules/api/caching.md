# API Caching

> Copy-paste ready. Cache API responses for better performance.

## Next.js Built-in Caching

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    const items = await db.select().from(posts).limit(20);

    return NextResponse.json(
      { items },
      {
        headers: {
          // Cache for 60 seconds, allow stale for 300 while revalidating
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Redis Caching

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // Try cache first
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  await redis.setex(key, ttlSeconds, data);

  return data;
}

export async function invalidate(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cached } from '@/lib/cache';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';

    const items = await cached(
      `products:${category}`,
      async () => {
        return db.select().from(products).limit(50);
      },
      300 // Cache for 5 minutes
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Invalidate on Mutation

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { invalidate } from '@/lib/cache';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const product = await db.insert(products).values(body).returning();

    // Invalidate related caches
    await invalidate('products:*');

    return NextResponse.json({ product: product[0] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Request Deduplication

```typescript
// lib/dedupe.ts
const inFlight = new Map<string, Promise<any>>();

export async function dedupe<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Return existing request if in flight
  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  // Start new request
  const promise = fetcher().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}
```

## Test

```typescript
// lib/cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cached, invalidate } from './cache';

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn(),
      setex: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      del: vi.fn(),
    }),
  },
}));

describe('cached', () => {
  it('calls fetcher when cache is empty', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });

    const result = await cached('test-key', fetcher);

    expect(fetcher).toHaveBeenCalled();
    expect(result).toEqual({ data: 'fresh' });
  });
});
```

## Usage
Use caching for expensive database queries, external API calls, and frequently accessed data.
