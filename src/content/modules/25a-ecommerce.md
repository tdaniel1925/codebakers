# E-COMMERCE EXPERT
# Module: 25a-ecommerce.md
# Load with: 00-core.md
# Covers: Products, carts, orders, inventory, checkout, abandoned carts

---

## 🛒 E-COMMERCE EXPERT PERSPECTIVE

When building e-commerce applications, focus on conversion optimization,
inventory management, and seamless checkout experiences.

### E-commerce Database Schema

```typescript
// db/schema/ecommerce.ts
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, decimal } from 'drizzle-orm/pg-core';

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: text('sku').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  shortDescription: text('short_description'),
  priceInCents: integer('price_in_cents').notNull(),
  comparePriceInCents: integer('compare_price_in_cents'),
  costInCents: integer('cost_in_cents'),
  currency: text('currency').default('usd').notNull(),
  status: text('status').default('draft').notNull(), // 'draft', 'active', 'archived'
  productType: text('product_type').notNull(), // 'physical', 'digital', 'service'
  vendor: text('vendor'),
  categoryId: uuid('category_id').references(() => productCategories.id),
  taxable: boolean('taxable').default(true),
  taxCode: text('tax_code'),
  weight: integer('weight'), // In grams
  dimensions: jsonb('dimensions').$type<{
    length: number;
    width: number;
    height: number;
    unit: 'in' | 'cm';
  }>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
});

// Product Variants (size, color, etc.)
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku').unique().notNull(),
  title: text('title').notNull(),
  priceInCents: integer('price_in_cents').notNull(),
  comparePriceInCents: integer('compare_price_in_cents'),
  costInCents: integer('cost_in_cents'),
  options: jsonb('options').$type<Record<string, string>>().notNull(),
  barcode: text('barcode'),
  weight: integer('weight'),
  inventoryQuantity: integer('inventory_quantity').default(0).notNull(),
  inventoryPolicy: text('inventory_policy').default('deny').notNull(),
  requiresShipping: boolean('requires_shipping').default(true),
  position: integer('position').default(0),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Product Categories
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  parentId: uuid('parent_id').references(() => productCategories.id),
  imageUrl: text('image_url'),
  position: integer('position').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Orders
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').unique().notNull(),
  userId: uuid('user_id'),
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status').default('pending').notNull(),
  financialStatus: text('financial_status').default('pending').notNull(),
  fulfillmentStatus: text('fulfillment_status').default('unfulfilled').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
  discountCents: integer('discount_cents').default(0).notNull(),
  shippingCents: integer('shipping_cents').default(0).notNull(),
  taxCents: integer('tax_cents').default(0).notNull(),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').default('usd').notNull(),
  shippingAddress: jsonb('shipping_address').$type<{
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  }>(),
  billingAddress: jsonb('billing_address').$type<{
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>(),
  paymentMethod: text('payment_method'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  shippingMethod: text('shipping_method'),
  trackingNumber: text('tracking_number'),
  trackingUrl: text('tracking_url'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  discountCodes: jsonb('discount_codes').$type<string[]>(),
  customerNote: text('customer_note'),
  internalNote: text('internal_note'),
  source: text('source').default('web'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
});

// Shopping Cart
export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  sessionId: text('session_id'),
  email: text('email'),
  subtotalCents: integer('subtotal_cents').default(0).notNull(),
  discountCents: integer('discount_cents').default(0).notNull(),
  currency: text('currency').default('usd').notNull(),
  discountCodes: jsonb('discount_codes').$type<string[]>(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  abandonedEmailSentAt: timestamp('abandoned_email_sent_at'),
});

// Discount Codes
export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  description: text('description'),
  discountType: text('discount_type').notNull(),
  discountValue: integer('discount_value').notNull(),
  minimumOrderCents: integer('minimum_order_cents'),
  maximumDiscountCents: integer('maximum_discount_cents'),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0),
  usageLimitPerCustomer: integer('usage_limit_per_customer'),
  appliesToAllProducts: boolean('applies_to_all_products').default(true),
  productIds: jsonb('product_ids').$type<string[]>(),
  categoryIds: jsonb('category_ids').$type<string[]>(),
  startsAt: timestamp('starts_at'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Cart Service

```typescript
// services/ecommerce/cart-service.ts
import { db } from '@/db';
import { carts, cartItems, productVariants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class CartService {
  static async getOrCreateCart(userId?: string, sessionId?: string): Promise<string> {
    if (userId) {
      const [existing] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (existing) return existing.id;
    } else if (sessionId) {
      const [existing] = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
      if (existing) return existing.id;
    }

    const [cart] = await db.insert(carts).values({
      userId,
      sessionId: sessionId || nanoid(),
    }).returning();

    return cart.id;
  }

  static async addItem(
    cartId: string,
    variantId: string,
    quantity: number = 1
  ): Promise<{ success: boolean; error?: string }> {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);

    if (!variant) return { success: false, error: 'Product not found' };

    const [existingItem] = await db.select().from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId))).limit(1);

    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (variant.inventoryPolicy === 'deny' && newQuantity > variant.inventoryQuantity) {
      return { success: false, error: `Only ${variant.inventoryQuantity} available` };
    }

    if (existingItem) {
      await db.update(cartItems).set({ quantity: newQuantity }).where(eq(cartItems.id, existingItem.id));
    } else {
      await db.insert(cartItems).values({ cartId, productId: variant.productId, variantId, quantity });
    }

    await this.recalculateCart(cartId);
    return { success: true };
  }

  static async recalculateCart(cartId: string): Promise<void> {
    const items = await db.select({
      quantity: cartItems.quantity,
      priceInCents: productVariants.priceInCents,
    }).from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.cartId, cartId));

    const subtotalCents = items.reduce((sum, item) => sum + (item.quantity * item.priceInCents), 0);
    await db.update(carts).set({ subtotalCents, updatedAt: new Date() }).where(eq(carts.id, cartId));
  }
}
```

### Inventory Service

```typescript
// services/ecommerce/inventory-service.ts
import { db } from '@/db';
import { productVariants, inventoryTransactions } from '@/db/schema';
import { eq, lt } from 'drizzle-orm';

export class InventoryService {
  static async reserveInventory(
    items: Array<{ variantId: string; quantity: number }>,
    orderId: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const item of items) {
      const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);

      if (!variant) { errors.push(`Variant ${item.variantId} not found`); continue; }
      if (variant.inventoryPolicy === 'deny' && variant.inventoryQuantity < item.quantity) {
        errors.push(`Insufficient stock for ${variant.title}`); continue;
      }

      const newQuantity = variant.inventoryQuantity - item.quantity;
      await db.update(productVariants).set({ inventoryQuantity: newQuantity, updatedAt: new Date() })
        .where(eq(productVariants.id, item.variantId));

      await db.insert(inventoryTransactions).values({
        variantId: item.variantId,
        quantityChange: -item.quantity,
        previousQuantity: variant.inventoryQuantity,
        newQuantity,
        reason: 'order',
        referenceType: 'order',
        referenceId: orderId,
      });
    }

    return { success: errors.length === 0, errors };
  }

  static async getLowStockVariants(threshold: number = 10) {
    return db.select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      title: productVariants.title,
      inventoryQuantity: productVariants.inventoryQuantity,
    }).from(productVariants).where(lt(productVariants.inventoryQuantity, threshold));
  }
}
```

### E-commerce Launch Checklist

```markdown
## E-commerce Launch Checklist

### Products
- [ ] All products have clear titles and descriptions
- [ ] All products have high-quality images
- [ ] Pricing is correct (including compare prices for sales)
- [ ] SKUs are unique and properly formatted
- [ ] Categories are organized logically

### Inventory
- [ ] Initial inventory counts are accurate
- [ ] Low stock thresholds are set
- [ ] Out-of-stock behavior is configured

### Checkout
- [ ] Guest checkout works
- [ ] Registered user checkout works
- [ ] All payment methods tested
- [ ] Tax calculation is accurate
- [ ] Shipping options display correctly
- [ ] Discount codes work
- [ ] Order confirmation emails send

### Operations
- [ ] Low stock alerts configured
- [ ] Abandoned cart emails set up
- [ ] Order notification emails working
```

---
