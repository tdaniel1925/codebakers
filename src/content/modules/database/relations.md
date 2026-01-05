# Database Relations

> Copy-paste ready. Query related data with Drizzle ORM.

## Define Relations

```typescript
// lib/db/schema.ts
import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
});

// Posts table
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: uuid('author_id').notNull().references(() => users.id),
});

// Comments table
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  postId: uuid('post_id').notNull().references(() => posts.id),
  authorId: uuid('author_id').notNull().references(() => users.id),
});

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

// Post relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

// Comment relations
export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
```

## Query with Relations

```typescript
// Get user with posts
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';

const userWithPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: true,
  },
});
// Returns: { id, email, name, posts: [...] }
```

```typescript
// Get post with author and comments
const postWithDetails = await db.query.posts.findFirst({
  where: eq(posts.id, postId),
  with: {
    author: true,
    comments: {
      with: {
        author: true,
      },
    },
  },
});
// Returns: { id, title, author: {...}, comments: [{ content, author: {...} }] }
```

```typescript
// Get all posts with authors
const allPosts = await db.query.posts.findMany({
  with: {
    author: {
      columns: {
        id: true,
        name: true,
        // Exclude email for privacy
      },
    },
  },
  orderBy: (posts, { desc }) => [desc(posts.createdAt)],
  limit: 20,
});
```

## Select Specific Columns

```typescript
// Only get specific fields from relations
const posts = await db.query.posts.findMany({
  columns: {
    id: true,
    title: true,
    createdAt: true,
  },
  with: {
    author: {
      columns: {
        name: true,
      },
    },
  },
});
// Returns: [{ id, title, createdAt, author: { name } }]
```

## Filter Relations

```typescript
// Get user with only published posts
const userWithPublishedPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: {
      where: eq(posts.published, true),
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
      limit: 10,
    },
  },
});
```

## Join Alternative (More Control)

```typescript
// Manual join when you need more control
import { eq } from 'drizzle-orm';

const postsWithAuthors = await db
  .select({
    post: posts,
    authorName: users.name,
    authorEmail: users.email,
  })
  .from(posts)
  .leftJoin(users, eq(posts.authorId, users.id))
  .where(eq(posts.published, true));
```

```typescript
// Count with join
import { count, eq } from 'drizzle-orm';

const postCounts = await db
  .select({
    userId: users.id,
    userName: users.name,
    postCount: count(posts.id),
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId))
  .groupBy(users.id, users.name);
```

## API Route Example

```typescript
// app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, posts } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: {
        author: {
          columns: { id: true, name: true },
        },
        comments: {
          with: {
            author: {
              columns: { id: true, name: true },
            },
          },
          orderBy: (comments, { desc }) => [desc(comments.createdAt)],
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Test

```typescript
// Test relation queries
import { describe, it, expect, vi } from 'vitest';

describe('Relations', () => {
  it('loads post with author', async () => {
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, 'test-id'),
      with: { author: true },
    });

    expect(post?.author).toBeDefined();
    expect(post?.author?.name).toBeDefined();
  });
});
```

## Usage
Use `db.query.*.findFirst/findMany` for relation queries. Use manual joins for aggregations.
