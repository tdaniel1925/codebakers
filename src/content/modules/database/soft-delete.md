# Soft Delete

> Copy-paste ready. Mark records as deleted without removing them.

## Schema with Soft Delete

```typescript
// lib/db/schema.ts
import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // Soft delete fields
  deletedAt: timestamp('deleted_at'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

## Soft Delete Function

```typescript
// lib/db/soft-delete.ts
import { db, users, posts } from '@/lib/db';
import { eq, isNull, isNotNull } from 'drizzle-orm';

// Soft delete a record
export async function softDelete(table: typeof users | typeof posts, id: string) {
  return await db
    .update(table)
    .set({
      deletedAt: new Date(),
      isDeleted: true,
    })
    .where(eq(table.id, id))
    .returning();
}

// Restore a soft-deleted record
export async function restore(table: typeof users | typeof posts, id: string) {
  return await db
    .update(table)
    .set({
      deletedAt: null,
      isDeleted: false,
    })
    .where(eq(table.id, id))
    .returning();
}

// Permanently delete (hard delete)
export async function hardDelete(table: typeof users | typeof posts, id: string) {
  return await db
    .delete(table)
    .where(eq(table.id, id))
    .returning();
}
```

## Query Helpers

```typescript
// lib/db/queries.ts
import { db, users, posts } from '@/lib/db';
import { eq, isNull, isNotNull, and } from 'drizzle-orm';

// Get only non-deleted records
export async function getActiveUsers() {
  return await db
    .select()
    .from(users)
    .where(isNull(users.deletedAt));
}

// Get only deleted records (for admin/trash view)
export async function getDeletedUsers() {
  return await db
    .select()
    .from(users)
    .where(isNotNull(users.deletedAt));
}

// Get all records (including deleted)
export async function getAllUsers(includeDeleted = false) {
  if (includeDeleted) {
    return await db.select().from(users);
  }
  return await db.select().from(users).where(isNull(users.deletedAt));
}

// Get user by ID (only if not deleted)
export async function getUserById(id: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(
      eq(users.id, id),
      isNull(users.deletedAt)
    ))
    .limit(1);

  return result[0] || null;
}
```

## API Routes

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, isNull, and } from 'drizzle-orm';

// GET - only returns non-deleted users
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await db
    .select()
    .from(users)
    .where(and(
      eq(users.id, id),
      isNull(users.deletedAt)
    ))
    .limit(1);

  if (user.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user: user[0] });
}

// DELETE - soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const deleted = await db
    .update(users)
    .set({ deletedAt: new Date(), isDeleted: true })
    .where(eq(users.id, id))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'User deleted' });
}
```

```typescript
// app/api/users/[id]/restore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const restored = await db
    .update(users)
    .set({ deletedAt: null, isDeleted: false })
    .where(eq(users.id, id))
    .returning();

  if (restored.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: restored[0] });
}
```

## Automatic Cleanup Job

```typescript
// scripts/cleanup-deleted.ts
import { db, users, posts } from '@/lib/db';
import { lt, isNotNull, and } from 'drizzle-orm';

const RETENTION_DAYS = 30;

async function cleanupOldDeleted() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  // Permanently delete records older than retention period
  const deletedUsers = await db
    .delete(users)
    .where(and(
      isNotNull(users.deletedAt),
      lt(users.deletedAt, cutoff)
    ))
    .returning({ id: users.id });

  const deletedPosts = await db
    .delete(posts)
    .where(and(
      isNotNull(posts.deletedAt),
      lt(posts.deletedAt, cutoff)
    ))
    .returning({ id: posts.id });

  console.log(`Cleaned up ${deletedUsers.length} users, ${deletedPosts.length} posts`);
}

cleanupOldDeleted().catch(console.error);
```

## Middleware for Automatic Filtering

```typescript
// lib/db/with-soft-delete.ts
import { db } from '@/lib/db';
import { isNull } from 'drizzle-orm';

// Create a query builder that always filters deleted records
export function createSoftDeleteQuery<T extends { deletedAt: any }>(table: T) {
  return {
    findActive: () => db.select().from(table).where(isNull(table.deletedAt)),
    findById: (id: string) => db
      .select()
      .from(table)
      .where(and(eq(table.id, id), isNull(table.deletedAt)))
      .limit(1),
  };
}
```

## Test

```typescript
// lib/db/soft-delete.test.ts
import { describe, it, expect } from 'vitest';
import { db, users } from '@/lib/db';
import { softDelete, restore, getUserById } from './soft-delete';

describe('Soft Delete', () => {
  it('soft deletes a user', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: 'test@example.com' })
      .returning();

    await softDelete(users, user.id);

    const found = await getUserById(user.id);
    expect(found).toBeNull();
  });

  it('restores a soft-deleted user', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: 'test@example.com' })
      .returning();

    await softDelete(users, user.id);
    await restore(users, user.id);

    const found = await getUserById(user.id);
    expect(found).not.toBeNull();
  });
});
```

## Usage
Use soft delete for data that might need recovery. Set up cleanup jobs for GDPR compliance.
