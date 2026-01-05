# Pagination

> Copy-paste ready. Cursor-based and offset pagination for API routes.

## Cursor-Based Pagination (Recommended)

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts } from '@/lib/db/schema';
import { gt, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor'); // Last item's ID
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Build query
    let query = db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there's more

    if (cursor) {
      query = query.where(gt(posts.id, cursor));
    }

    const items = await query;

    // Check if there are more items
    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // Remove the extra item
    }

    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      items,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Offset Pagination

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sql, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Get items and total count in parallel
    const [items, totalResult] = await Promise.all([
      db.select().from(users).limit(limit).offset(offset),
      db.select({ count: count() }).from(users),
    ]);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Reusable Helper

```typescript
// lib/pagination.ts
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  return {
    page: Math.max(parseInt(searchParams.get('page') || '1'), 1),
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    cursor: searchParams.get('cursor') || undefined,
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## Test

```typescript
// app/api/posts/route.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/posts', () => {
  it('returns paginated results', async () => {
    const req = new Request('http://test/api/posts?limit=5');
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(5);
    expect(data).toHaveProperty('hasMore');
  });

  it('respects max limit of 100', async () => {
    const req = new Request('http://test/api/posts?limit=500');
    const res = await GET(req as any);

    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(100);
  });
});
```

## Usage
Use cursor-based pagination for infinite scroll. Use offset pagination for page numbers.
