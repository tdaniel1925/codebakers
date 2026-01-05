# CRUD Operations

> Copy-paste ready. Create, Read, Update, Delete with Drizzle.

## Create

```typescript
// Create single record
import { db, users, NewUser } from '@/lib/db';

const newUser: NewUser = {
  email: 'user@example.com',
  name: 'John Doe',
};

const user = await db.insert(users).values(newUser).returning();
// Returns: [{ id: '...', email: '...', name: '...', ... }]
```

```typescript
// Create multiple records
const newUsers: NewUser[] = [
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
];

const createdUsers = await db.insert(users).values(newUsers).returning();
```

## Read

```typescript
// Get all records
import { db, users } from '@/lib/db';

const allUsers = await db.select().from(users);
```

```typescript
// Get with filter
import { eq, and, or, like, gt, lt } from 'drizzle-orm';

// Single condition
const admins = await db
  .select()
  .from(users)
  .where(eq(users.role, 'admin'));

// Multiple conditions
const recentAdmins = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.role, 'admin'),
      gt(users.createdAt, new Date('2024-01-01'))
    )
  );

// Search with LIKE
const search = await db
  .select()
  .from(users)
  .where(like(users.name, '%John%'));
```

```typescript
// Get by ID
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);
// Returns: [user] or []

// Or use findFirst with relations
const userWithPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: true,
  },
});
```

```typescript
// Select specific columns
const emails = await db
  .select({ email: users.email, name: users.name })
  .from(users);
```

## Update

```typescript
// Update by ID
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

const updated = await db
  .update(users)
  .set({ name: 'New Name', updatedAt: new Date() })
  .where(eq(users.id, userId))
  .returning();
```

```typescript
// Update multiple records
await db
  .update(users)
  .set({ role: 'premium' })
  .where(eq(users.role, 'user'));
```

```typescript
// Upsert (insert or update on conflict)
await db
  .insert(users)
  .values({ email: 'user@example.com', name: 'User' })
  .onConflictDoUpdate({
    target: users.email,
    set: { name: 'Updated Name', updatedAt: new Date() },
  });
```

## Delete

```typescript
// Delete by ID
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

const deleted = await db
  .delete(users)
  .where(eq(users.id, userId))
  .returning();
```

```typescript
// Delete with conditions
await db
  .delete(users)
  .where(
    and(
      eq(users.role, 'guest'),
      lt(users.createdAt, new Date('2024-01-01'))
    )
  );
```

## Full API Route Example

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/users/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: user[0] });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/users/[id]
const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = UpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 }
      );
    }

    const updated = await db
      .update(users)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updated[0] });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Test

```typescript
// app/api/users/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: '123', email: 'test@example.com' }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: '123', email: 'test@example.com' }]),
  },
  users: {},
}));

describe('CRUD operations', () => {
  it('returns user by ID', async () => {
    const { db, users } = await import('@/lib/db');
    const result = await db.select().from(users).where({}).limit(1);
    expect(result).toHaveLength(1);
  });
});
```

## Usage
Use `.returning()` to get the affected rows. Always handle not-found cases.
