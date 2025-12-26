# PERFORMANCE & OPTIMIZATION
# Module: 07-performance.md
# Load with: 00-core.md

---

# PART 11: CACHING & PERFORMANCE

## 🚀 CACHING STRATEGIES

### Next.js Caching

```typescript
// app/api/data/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const data = await fetchData();
  
  return NextResponse.json(data, {
    headers: {
      // Cache for 1 hour, revalidate in background
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

// For Server Components with revalidation
export const revalidate = 3600; // Revalidate every hour

async function DataPage() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  
  return <div>{/* render data */}</div>;
}

// With cache tags for targeted revalidation
async function ProductPage({ id }: { id: string }) {
  const product = await fetch(`https://api.example.com/products/${id}`, {
    next: { tags: [`product-${id}`] },
  });
  
  return <div>{/* render product */}</div>;
}

// Revalidate by tag
import { revalidateTag } from 'next/cache';

export async function updateProduct(id: string) {
  await db.update(products).set({ /* ... */ }).where(eq(products.id, id));
  revalidateTag(`product-${id}`);
}
```

### React Query / TanStack Query

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// hooks/use-users.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useUsers(organizationId: string) {
  return useQuery({
    queryKey: ['users', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
  });
}

export function useCreateUser(organizationId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await fetch(`/api/organizations/${organizationId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create user');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: ['users', organizationId] });
    },
    // Optimistic update
    onMutate: async (newUser) => {
      await queryClient.cancelQueries({ queryKey: ['users', organizationId] });
      const previousUsers = queryClient.getQueryData(['users', organizationId]);
      queryClient.setQueryData(['users', organizationId], (old: any) => ({
        ...old,
        data: [...(old?.data || []), { ...newUser, id: 'temp-id' }],
      }));
      return { previousUsers };
    },
    onError: (err, newUser, context) => {
      queryClient.setQueryData(['users', organizationId], context?.previousUsers);
    },
  });
}
```

### Redis/Upstash Caching

```typescript
// lib/cache/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache helper with automatic JSON serialization
export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data as T | null;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  options?: { ex?: number; px?: number }
): Promise<void> {
  if (options?.ex) {
    await redis.setex(key, options.ex, JSON.stringify(value));
  } else if (options?.px) {
    await redis.set(key, JSON.stringify(value), { px: options.px });
  } else {
    await redis.set(key, JSON.stringify(value));
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Cache wrapper function
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try to get from cache
  const cached = await cacheGet<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache the result
  await cacheSet(key, data, { ex: ttlSeconds });

  return data;
}

// Usage example:
const users = await withCache(
  `org:${orgId}:users`,
  () => db.select().from(users).where(eq(users.orgId, orgId)),
  300 // Cache for 5 minutes
);
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './cache/redis';

// Create rate limiters for different use cases
export const rateLimiters = {
  // General API: 100 requests per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  // Auth endpoints: 5 requests per minute
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // AI endpoints: 10 requests per minute
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1m'),
    analytics: true,
    prefix: 'ratelimit:ai',
  }),

  // Webhooks: 1000 requests per minute
  webhook: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1m'),
    analytics: true,
    prefix: 'ratelimit:webhook',
  }),
};

// Middleware helper
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await limiter.limit(identifier);
  return { success, remaining, reset };
}

// Usage in API route:
export async function POST(req: NextRequest) {
  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
  
  const { success, remaining, reset } = await checkRateLimit(
    rateLimiters.api,
    ip
  );

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Continue with request handling...
}
```

---


---

# PART 34: PERFORMANCE OPTIMIZATION

## React Performance Rules

### 1. Memoization
```typescript
// Expensive computations - ALWAYS useMemo
const expensiveResult = useMemo(() => {
  return data.filter(item => item.active).map(item => ({
    ...item,
    computed: heavyCalculation(item)
  }));
}, [data]);

// Callback functions passed to children - ALWAYS useCallback
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);

// Components that receive objects/arrays - ALWAYS React.memo
const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
  return (
    <ul>
      {items.map(item => <li key={item.id}>{item.name}</li>)}
    </ul>
  );
});
```

### 2. Code Splitting
```typescript
// ALWAYS lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/heavy-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Disable SSR for client-only components
});

const AdminPanel = dynamic(() => import('@/components/admin-panel'), {
  loading: () => <AdminSkeleton />,
});
```

### 3. Image Optimization
```typescript
// ALWAYS use next/image
import Image from 'next/image';

// Good
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // For above-fold images
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>

// For dynamic images
<Image
  src={user.avatar}
  alt={user.name}
  width={48}
  height={48}
  className="rounded-full"
/>
```

### 4. Database Query Optimization
```typescript
// ALWAYS select only needed fields
const users = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
  })
  .from(users)
  .where(eq(users.active, true))
  .limit(20);

// ALWAYS use indexes for filtered columns
// Add to schema:
// CREATE INDEX idx_users_active ON users(active);
// CREATE INDEX idx_users_email ON users(email);

// ALWAYS paginate large datasets
const { items, nextCursor } = await getPaginatedItems({
  cursor: params.cursor,
  limit: 20,
});
```

### 5. Caching Strategy
```typescript
// API Response Caching
export async function GET(request: Request) {
  // Cache for 60 seconds, revalidate in background
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

// React Query / SWR Caching
const { data } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => fetchUsers(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 30 * 60 * 1000, // 30 minutes
});
```

---


---

# PART 103: PERFORMANCE STANDARDS

## 🚀 MANDATORY PERFORMANCE OPTIMIZATION

Every piece of code must be optimized. Fast apps = happy users = better retention.

---

## Database Performance

### ALWAYS DO:

```typescript
// ✅ Select only needed columns
const users = await db
  .select({ 
    id: users.id, 
    name: users.name, 
    email: users.email 
  })
  .from(users)
  .where(eq(users.teamId, teamId));

// ✅ Always paginate - NEVER return unlimited rows
const posts = await db
  .select()
  .from(posts)
  .where(eq(posts.userId, userId))
  .orderBy(desc(posts.createdAt))
  .limit(50)
  .offset(page * 50);

// ✅ Cursor-based pagination for large datasets
const posts = await db
  .select()
  .from(posts)
  .where(and(
    eq(posts.userId, userId),
    cursor ? lt(posts.createdAt, cursor) : undefined
  ))
  .orderBy(desc(posts.createdAt))
  .limit(51); // +1 to check if more exist

// ✅ Create indexes for WHERE and ORDER BY columns
CREATE INDEX posts_user_created_idx ON posts(user_id, created_at DESC);

// ✅ Use EXISTS instead of COUNT for existence checks
const hasAccess = await db.execute(sql`
  SELECT EXISTS(
    SELECT 1 FROM team_members 
    WHERE user_id = ${userId} AND team_id = ${teamId}
  )
`);
```

### NEVER DO:

```typescript
// ❌ Select all columns
const users = await db.select().from(users);

// ❌ No limit
const allPosts = await db.select().from(posts);

// ❌ N+1 queries - querying in a loop
for (const user of users) {
  const posts = await db.select().from(posts).where(eq(posts.userId, user.id));
  // This runs 100 queries for 100 users!
}

// ✅ Fix N+1 with single query
const allPosts = await db
  .select()
  .from(posts)
  .where(inArray(posts.userId, users.map(u => u.id)));

// Then group in JavaScript
const postsByUser = allPosts.reduce((acc, post) => {
  acc[post.userId] = acc[post.userId] || [];
  acc[post.userId].push(post);
  return acc;
}, {});
```

---

## Frontend Performance

### React Optimization Rules:

```typescript
// ✅ Lazy load heavy components
const HeavyChart = lazy(() => import('@/components/heavy-chart'));

// ✅ Memoize expensive calculations
const sortedData = useMemo(() => {
  return data.sort((a, b) => b.value - a.value);
}, [data]);

// ✅ Memoize callbacks passed to children
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);

// ✅ Debounce search/filter inputs
const debouncedSearch = useDebouncedCallback((value: string) => {
  setSearchQuery(value);
}, 300);

// ✅ Virtualize long lists (100+ items)
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              height: virtualItem.size,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Image Optimization:

```typescript
// ✅ Always use next/image with dimensions
import Image from 'next/image';

<Image
  src={user.avatar}
  alt={user.name}
  width={48}
  height={48}
  className="rounded-full"
  loading="lazy" // Below fold
/>

// ✅ Priority for above-fold images
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // Above fold - preload
/>

// ✅ Use placeholder blur for large images
<Image
  src={photo.url}
  alt={photo.title}
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL={photo.blurHash}
/>
```

### Bundle Optimization:

```typescript
// ❌ Never import entire libraries
import _ from 'lodash';
import moment from 'moment';

// ✅ Import only what you need
import debounce from 'lodash/debounce';
import { format, parseISO } from 'date-fns';

// ✅ Dynamic import for heavy components
const PDFViewer = dynamic(() => import('@/components/pdf-viewer'), {
  loading: () => <Skeleton className="h-[600px]" />,
  ssr: false,
});

// ✅ Check bundle impact before adding deps
// Run: npx @next/bundle-analyzer
// If dep adds >50KB, find alternative or lazy load
```

---

## API Performance

### Caching Rules:

```typescript
// ✅ Cache static data
export async function getCategories() {
  return unstable_cache(
    async () => {
      return db.select().from(categories);
    },
    ['categories'],
    { revalidate: 3600 } // 1 hour
  )();
}

// ✅ Set cache headers for API routes
export async function GET() {
  const data = await getPublicData();
  
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

// ✅ Use ISR for semi-static pages
export const revalidate = 60; // Revalidate every 60 seconds

// ✅ Return only needed fields
return NextResponse.json({
  users: users.map(u => ({
    id: u.id,
    name: u.name,
    // Don't include: passwordHash, internalNotes, etc.
  })),
});
```

### Response Optimization:

```typescript
// ✅ Compress large responses
import { NextResponse } from 'next/server';

export async function GET() {
  const largeData = await getLargeDataset();
  
  return new NextResponse(JSON.stringify(largeData), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip', // Let Vercel/CDN handle compression
    },
  });
}

// ✅ Stream large responses
export async function GET() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of getDataChunks()) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
```

---

## Performance Checklist

Before every PR/commit, verify:

```markdown
## Database
- [ ] Selecting only needed columns
- [ ] Pagination on all list queries (max 50-100)
- [ ] No N+1 queries (no queries in loops)
- [ ] Indexes exist for WHERE/ORDER BY columns
- [ ] Using EXISTS instead of COUNT for checks

## Frontend
- [ ] Images use next/image with dimensions
- [ ] Below-fold components are lazy loaded
- [ ] Lists over 50 items are virtualized
- [ ] Search inputs are debounced (300ms)
- [ ] Expensive calculations are memoized

## API
- [ ] Static data is cached
- [ ] Responses include only needed fields
- [ ] Cache headers set appropriately
- [ ] Large responses are streamed or paginated

## Bundle
- [ ] No full library imports (lodash, moment)
- [ ] Heavy components dynamically imported
- [ ] Bundle size checked before new deps
```

---

