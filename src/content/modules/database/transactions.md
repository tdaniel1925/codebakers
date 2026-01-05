# Database Transactions

> Copy-paste ready. Atomic operations with Drizzle ORM.

## Basic Transaction

```typescript
import { db, users, posts, comments } from '@/lib/db';

// All operations succeed or all fail
await db.transaction(async (tx) => {
  // Create user
  const [user] = await tx
    .insert(users)
    .values({ email: 'new@example.com', name: 'New User' })
    .returning();

  // Create their first post
  const [post] = await tx
    .insert(posts)
    .values({ title: 'My First Post', authorId: user.id })
    .returning();

  // Add a comment
  await tx.insert(comments).values({
    content: 'Welcome!',
    postId: post.id,
    authorId: user.id,
  });

  return { user, post };
});
```

## Transaction with Error Handling

```typescript
import { db, users, accounts } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

async function transferCredits(fromId: string, toId: string, amount: number) {
  try {
    await db.transaction(async (tx) => {
      // Deduct from sender
      const [sender] = await tx
        .update(accounts)
        .set({ credits: sql`${accounts.credits} - ${amount}` })
        .where(eq(accounts.userId, fromId))
        .returning();

      // Check if sender has enough credits
      if (sender.credits < 0) {
        throw new Error('Insufficient credits');
      }

      // Add to receiver
      await tx
        .update(accounts)
        .set({ credits: sql`${accounts.credits} + ${amount}` })
        .where(eq(accounts.userId, toId));

      // Log the transaction
      await tx.insert(transactions).values({
        fromId,
        toId,
        amount,
        type: 'transfer',
      });
    });

    return { success: true };
  } catch (error) {
    // Transaction automatically rolled back
    console.error('Transfer failed:', error);
    return { success: false, error: (error as Error).message };
  }
}
```

## Nested Operations

```typescript
import { db, orders, orderItems, inventory } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

async function createOrder(userId: string, items: OrderItem[]) {
  return await db.transaction(async (tx) => {
    // Create order
    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        status: 'pending',
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      })
      .returning();

    // Create order items and update inventory
    for (const item of items) {
      // Add order item
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      });

      // Decrease inventory
      const [updated] = await tx
        .update(inventory)
        .set({ quantity: sql`${inventory.quantity} - ${item.quantity}` })
        .where(eq(inventory.productId, item.productId))
        .returning();

      // Check stock
      if (updated.quantity < 0) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    return order;
  });
}
```

## Transaction with Rollback Points

```typescript
import { db, users, profiles, settings } from '@/lib/db';

async function onboardUser(email: string, name: string) {
  return await db.transaction(async (tx) => {
    // Step 1: Create user
    const [user] = await tx
      .insert(users)
      .values({ email, name })
      .returning();

    try {
      // Step 2: Create profile (might fail)
      await tx.insert(profiles).values({
        userId: user.id,
        bio: '',
      });
    } catch (error) {
      // Profile creation failed, but we still want the user
      console.warn('Profile creation failed, continuing...');
    }

    // Step 3: Create default settings
    await tx.insert(settings).values({
      userId: user.id,
      theme: 'light',
      notifications: true,
    });

    return user;
  });
}
```

## API Route Example

```typescript
// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, orders, orderItems, inventory } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const OrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = OrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid order data' },
        { status: 400 }
      );
    }

    const order = await db.transaction(async (tx) => {
      // Get product prices
      const products = await tx
        .select()
        .from(inventory)
        .where(
          sql`${inventory.productId} IN (${result.data.items.map(i => i.productId).join(',')})`
        );

      // Calculate total
      let total = 0;
      for (const item of result.data.items) {
        const product = products.find(p => p.productId === item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
        total += product.price * item.quantity;
      }

      // Create order
      const [newOrder] = await tx
        .insert(orders)
        .values({ total, status: 'pending' })
        .returning();

      // Create items and update stock
      for (const item of result.data.items) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
        });

        await tx
          .update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${item.quantity}` })
          .where(eq(inventory.productId, item.productId));
      }

      return newOrder;
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
```

## Test

```typescript
// Test transaction rollback
import { describe, it, expect } from 'vitest';

describe('Transactions', () => {
  it('rolls back on error', async () => {
    const initialBalance = 100;

    try {
      await db.transaction(async (tx) => {
        await tx.update(accounts).set({ balance: 50 });
        throw new Error('Simulated failure');
      });
    } catch (e) {
      // Expected
    }

    // Balance should be unchanged
    const account = await db.select().from(accounts).limit(1);
    expect(account[0].balance).toBe(initialBalance);
  });
});
```

## Usage
Use transactions for multi-table operations that must succeed or fail together. Always handle errors.
