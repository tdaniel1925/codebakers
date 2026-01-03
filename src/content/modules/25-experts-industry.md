# INDUSTRY-SPECIFIC EXPERTS
# Module: 25-experts-industry.md
# Load with: 00-core.md

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
  comparePriceInCents: integer('compare_price_in_cents'), // Original price for sales
  costInCents: integer('cost_in_cents'), // For profit tracking
  currency: text('currency').default('usd').notNull(),
  status: text('status').default('draft').notNull(), // 'draft', 'active', 'archived'
  productType: text('product_type').notNull(), // 'physical', 'digital', 'service'
  vendor: text('vendor'),
  categoryId: uuid('category_id').references(() => productCategories.id),
  taxable: boolean('taxable').default(true),
  taxCode: text('tax_code'), // For tax calculation services
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
  title: text('title').notNull(), // e.g., "Large / Blue"
  priceInCents: integer('price_in_cents').notNull(),
  comparePriceInCents: integer('compare_price_in_cents'),
  costInCents: integer('cost_in_cents'),
  options: jsonb('options').$type<Record<string, string>>().notNull(), // { size: 'L', color: 'Blue' }
  barcode: text('barcode'),
  weight: integer('weight'),
  inventoryQuantity: integer('inventory_quantity').default(0).notNull(),
  inventoryPolicy: text('inventory_policy').default('deny').notNull(), // 'deny', 'allow' (overselling)
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

// Product Images
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  altText: text('alt_text'),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Orders
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').unique().notNull(),
  userId: uuid('user_id'), // Nullable for guest checkout
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status').default('pending').notNull(),
  // Status flow: pending -> confirmed -> processing -> shipped -> delivered
  // Or: pending -> cancelled / refunded
  financialStatus: text('financial_status').default('pending').notNull(),
  // 'pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded'
  fulfillmentStatus: text('fulfillment_status').default('unfulfilled').notNull(),
  // 'unfulfilled', 'partial', 'fulfilled'
  
  // Pricing (all in cents)
  subtotalCents: integer('subtotal_cents').notNull(),
  discountCents: integer('discount_cents').default(0).notNull(),
  shippingCents: integer('shipping_cents').default(0).notNull(),
  taxCents: integer('tax_cents').default(0).notNull(),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').default('usd').notNull(),
  
  // Addresses (stored as JSON for history)
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
  
  // Payment
  paymentMethod: text('payment_method'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  
  // Shipping
  shippingMethod: text('shipping_method'),
  trackingNumber: text('tracking_number'),
  trackingUrl: text('tracking_url'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  
  // Discounts
  discountCodes: jsonb('discount_codes').$type<string[]>(),
  
  // Notes
  customerNote: text('customer_note'),
  internalNote: text('internal_note'),
  
  // Metadata
  source: text('source').default('web'), // 'web', 'mobile', 'api', 'pos'
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
});

// Order Line Items
export const orderLineItems = pgTable('order_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  
  // Snapshot at time of order (prices can change)
  sku: text('sku').notNull(),
  title: text('title').notNull(),
  variantTitle: text('variant_title'),
  imageUrl: text('image_url'),
  
  quantity: integer('quantity').notNull(),
  unitPriceInCents: integer('unit_price_in_cents').notNull(),
  totalPriceInCents: integer('total_price_in_cents').notNull(),
  discountCents: integer('discount_cents').default(0),
  taxCents: integer('tax_cents').default(0),
  
  // Fulfillment
  fulfilledQuantity: integer('fulfilled_quantity').default(0),
  requiresShipping: boolean('requires_shipping').default(true),
  
  // For digital products
  downloadUrl: text('download_url'),
  downloadLimit: integer('download_limit'),
  downloadCount: integer('download_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Shopping Cart
export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // Nullable for guest carts
  sessionId: text('session_id'), // For guest users
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

// Cart Items
export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  quantity: integer('quantity').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

// Discount Codes
export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  description: text('description'),
  discountType: text('discount_type').notNull(), // 'percentage', 'fixed_amount', 'free_shipping'
  discountValue: integer('discount_value').notNull(), // Percentage (1-100) or cents
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

// Inventory Transactions
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  quantityChange: integer('quantity_change').notNull(), // Positive or negative
  previousQuantity: integer('previous_quantity').notNull(),
  newQuantity: integer('new_quantity').notNull(),
  reason: text('reason').notNull(), // 'order', 'restock', 'adjustment', 'return', 'damage'
  referenceType: text('reference_type'), // 'order', 'return', 'adjustment'
  referenceId: uuid('reference_id'),
  note: text('note'),
  performedBy: uuid('performed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### E-commerce Cart Service

```typescript
// services/ecommerce/cart-service.ts
import { db } from '@/db';
import { carts, cartItems, productVariants, products } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class CartService {
  /**
   * Get or create cart
   */
  static async getOrCreateCart(
    userId?: string,
    sessionId?: string
  ): Promise<string> {
    // Try to find existing cart
    if (userId) {
      const [existing] = await db
        .select()
        .from(carts)
        .where(eq(carts.userId, userId))
        .limit(1);
      
      if (existing) return existing.id;
    } else if (sessionId) {
      const [existing] = await db
        .select()
        .from(carts)
        .where(eq(carts.sessionId, sessionId))
        .limit(1);
      
      if (existing) return existing.id;
    }
    
    // Create new cart
    const [cart] = await db.insert(carts).values({
      userId,
      sessionId: sessionId || nanoid(),
    }).returning();
    
    return cart.id;
  }
  
  /**
   * Add item to cart
   */
  static async addItem(
    cartId: string,
    variantId: string,
    quantity: number = 1
  ): Promise<{ success: boolean; error?: string }> {
    // Check variant exists and has stock
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);
    
    if (!variant) {
      return { success: false, error: 'Product not found' };
    }
    
    // Check existing cart item
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.variantId, variantId)
        )
      )
      .limit(1);
    
    const newQuantity = existingItem 
      ? existingItem.quantity + quantity 
      : quantity;
    
    // Check inventory
    if (variant.inventoryPolicy === 'deny' && newQuantity > variant.inventoryQuantity) {
      return { 
        success: false, 
        error: `Only ${variant.inventoryQuantity} available` 
      };
    }
    
    if (existingItem) {
      // Update quantity
      await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      // Add new item
      await db.insert(cartItems).values({
        cartId,
        productId: variant.productId,
        variantId,
        quantity,
      });
    }
    
    // Update cart totals
    await this.recalculateCart(cartId);
    
    return { success: true };
  }
  
  /**
   * Update item quantity
   */
  static async updateItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number
  ): Promise<{ success: boolean; error?: string }> {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }
    
    const [item] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(cartItems.cartId, cartId)
        )
      )
      .limit(1);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }
    
    // Check inventory
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, item.variantId))
      .limit(1);
    
    if (variant?.inventoryPolicy === 'deny' && quantity > variant.inventoryQuantity) {
      return { 
        success: false, 
        error: `Only ${variant.inventoryQuantity} available` 
      };
    }
    
    await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, itemId));
    
    await this.recalculateCart(cartId);
    
    return { success: true };
  }
  
  /**
   * Remove item from cart
   */
  static async removeItem(
    cartId: string,
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    await db
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(cartItems.cartId, cartId)
        )
      );
    
    await this.recalculateCart(cartId);
    
    return { success: true };
  }
  
  /**
   * Apply discount code
   */
  static async applyDiscountCode(
    cartId: string,
    code: string
  ): Promise<{ success: boolean; error?: string; discountCents?: number }> {
    const [discount] = await db
      .select()
      .from(discountCodes)
      .where(eq(discountCodes.code, code.toUpperCase()))
      .limit(1);
    
    if (!discount) {
      return { success: false, error: 'Invalid discount code' };
    }
    
    if (!discount.isActive) {
      return { success: false, error: 'Discount code is no longer active' };
    }
    
    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return { success: false, error: 'Discount code has expired' };
    }
    
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return { success: false, error: 'Discount code usage limit reached' };
    }
    
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1);
    
    if (discount.minimumOrderCents && cart.subtotalCents < discount.minimumOrderCents) {
      return { 
        success: false, 
        error: `Minimum order of $${(discount.minimumOrderCents / 100).toFixed(2)} required` 
      };
    }
    
    // Calculate discount
    let discountCents = 0;
    if (discount.discountType === 'percentage') {
      discountCents = Math.round(cart.subtotalCents * (discount.discountValue / 100));
    } else if (discount.discountType === 'fixed_amount') {
      discountCents = discount.discountValue;
    }
    
    // Apply maximum discount cap
    if (discount.maximumDiscountCents) {
      discountCents = Math.min(discountCents, discount.maximumDiscountCents);
    }
    
    // Update cart
    const existingCodes = (cart.discountCodes as string[]) || [];
    await db
      .update(carts)
      .set({
        discountCodes: [...existingCodes, code.toUpperCase()],
        discountCents,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cartId));
    
    return { success: true, discountCents };
  }
  
  /**
   * Recalculate cart totals
   */
  static async recalculateCart(cartId: string): Promise<void> {
    const items = await db
      .select({
        quantity: cartItems.quantity,
        priceInCents: productVariants.priceInCents,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.cartId, cartId));
    
    const subtotalCents = items.reduce(
      (sum, item) => sum + (item.quantity * item.priceInCents),
      0
    );
    
    await db
      .update(carts)
      .set({ subtotalCents, updatedAt: new Date() })
      .where(eq(carts.id, cartId));
  }
  
  /**
   * Merge guest cart into user cart
   */
  static async mergeGuestCart(
    guestCartId: string,
    userId: string
  ): Promise<void> {
    const userCartId = await this.getOrCreateCart(userId);
    
    // Get guest cart items
    const guestItems = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, guestCartId));
    
    // Add each item to user cart
    for (const item of guestItems) {
      await this.addItem(userCartId, item.variantId, item.quantity);
    }
    
    // Delete guest cart
    await db.delete(carts).where(eq(carts.id, guestCartId));
  }
  
  /**
   * Get full cart with items
   */
  static async getCartWithItems(cartId: string) {
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1);
    
    if (!cart) return null;
    
    const items = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        productName: products.name,
        variantTitle: productVariants.title,
        priceInCents: productVariants.priceInCents,
        imageUrl: productVariants.imageUrl,
        inventoryQuantity: productVariants.inventoryQuantity,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId));
    
    return {
      ...cart,
      items: items.map(item => ({
        ...item,
        lineTotalCents: item.quantity * item.priceInCents,
      })),
    };
  }
}
```

### Abandoned Cart Recovery

```typescript
// services/ecommerce/abandoned-cart-service.ts
import { db } from '@/db';
import { carts, cartItems, products, productVariants } from '@/db/schema';
import { and, eq, isNull, lt, isNotNull } from 'drizzle-orm';
import { EmailService } from '@/services/email-service';

export class AbandonedCartService {
  // Time thresholds for abandoned cart emails
  static readonly ABANDONMENT_THRESHOLD_HOURS = 1;
  static readonly FOLLOW_UP_HOURS = 24;
  static readonly FINAL_REMINDER_HOURS = 72;
  
  /**
   * Find abandoned carts eligible for email
   */
  static async findAbandonedCarts() {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.ABANDONMENT_THRESHOLD_HOURS);
    
    return db
      .select()
      .from(carts)
      .where(
        and(
          lt(carts.updatedAt, cutoffTime),
          isNull(carts.abandonedEmailSentAt),
          isNotNull(carts.email), // Must have email
          // Cart must have items - we'll filter this in code
        )
      );
  }
  
  /**
   * Process abandoned carts and send emails
   */
  static async processAbandonedCarts(): Promise<{ processed: number; emailed: number }> {
    const abandonedCarts = await this.findAbandonedCarts();
    let emailed = 0;
    
    for (const cart of abandonedCarts) {
      // Check if cart has items
      const items = await db
        .select({
          productName: products.name,
          variantTitle: productVariants.title,
          priceInCents: productVariants.priceInCents,
          imageUrl: productVariants.imageUrl,
          quantity: cartItems.quantity,
        })
        .from(cartItems)
        .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.cartId, cart.id));
      
      if (items.length === 0) continue;
      
      // Generate recovery URL with token
      const recoveryUrl = await this.generateRecoveryUrl(cart.id);
      
      // Send email
      await EmailService.send({
        to: cart.email!,
        templateId: 'abandoned-cart',
        data: {
          items,
          subtotal: cart.subtotalCents / 100,
          recoveryUrl,
          // Optional: include discount incentive
          discountCode: await this.generateIncentiveCode(cart.id),
        },
      });
      
      // Mark as sent
      await db
        .update(carts)
        .set({ abandonedEmailSentAt: new Date() })
        .where(eq(carts.id, cart.id));
      
      emailed++;
    }
    
    return { processed: abandonedCarts.length, emailed };
  }
  
  /**
   * Generate secure recovery URL
   */
  static async generateRecoveryUrl(cartId: string): Promise<string> {
    // In production, use a signed token
    const token = Buffer.from(`${cartId}:${Date.now()}`).toString('base64url');
    return `${process.env.NEXT_PUBLIC_APP_URL}/cart/recover?token=${token}`;
  }
  
  /**
   * Generate incentive discount code
   */
  static async generateIncentiveCode(cartId: string): Promise<string | null> {
    // Optional: Create a unique discount code for this cart
    // Return null if you don't want to offer discounts
    return null;
  }
}
```

### Inventory Management

```typescript
// services/ecommerce/inventory-service.ts
import { db } from '@/db';
import { productVariants, inventoryTransactions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class InventoryService {
  /**
   * Reserve inventory for order
   */
  static async reserveInventory(
    items: Array<{ variantId: string; quantity: number }>,
    orderId: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    for (const item of items) {
      const [variant] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);
      
      if (!variant) {
        errors.push(`Variant ${item.variantId} not found`);
        continue;
      }
      
      if (variant.inventoryPolicy === 'deny' && variant.inventoryQuantity < item.quantity) {
        errors.push(`Insufficient stock for ${variant.title}`);
        continue;
      }
      
      const newQuantity = variant.inventoryQuantity - item.quantity;
      
      // Update inventory
      await db
        .update(productVariants)
        .set({ 
          inventoryQuantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, item.variantId));
      
      // Log transaction
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
  
  /**
   * Release inventory (order cancelled)
   */
  static async releaseInventory(
    items: Array<{ variantId: string; quantity: number }>,
    orderId: string,
    reason: string = 'Order cancelled'
  ): Promise<void> {
    for (const item of items) {
      const [variant] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);
      
      if (!variant) continue;
      
      const newQuantity = variant.inventoryQuantity + item.quantity;
      
      await db
        .update(productVariants)
        .set({ 
          inventoryQuantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, item.variantId));
      
      await db.insert(inventoryTransactions).values({
        variantId: item.variantId,
        quantityChange: item.quantity,
        previousQuantity: variant.inventoryQuantity,
        newQuantity,
        reason: 'return',
        referenceType: 'order',
        referenceId: orderId,
        note: reason,
      });
    }
  }
  
  /**
   * Restock inventory
   */
  static async restock(
    variantId: string,
    quantity: number,
    performedBy: string,
    note?: string
  ): Promise<void> {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);
    
    if (!variant) throw new Error('Variant not found');
    
    const newQuantity = variant.inventoryQuantity + quantity;
    
    await db
      .update(productVariants)
      .set({ 
        inventoryQuantity: newQuantity,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId));
    
    await db.insert(inventoryTransactions).values({
      variantId,
      quantityChange: quantity,
      previousQuantity: variant.inventoryQuantity,
      newQuantity,
      reason: 'restock',
      performedBy,
      note,
    });
  }
  
  /**
   * Check low stock alerts
   */
  static async getLowStockVariants(threshold: number = 10) {
    return db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        title: productVariants.title,
        inventoryQuantity: productVariants.inventoryQuantity,
        productName: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(lt(productVariants.inventoryQuantity, threshold));
  }
}
```

### E-commerce Checklist

```markdown
## E-commerce Launch Checklist

### Products
- [ ] All products have clear titles and descriptions
- [ ] All products have high-quality images
- [ ] Pricing is correct (including compare prices for sales)
- [ ] SKUs are unique and properly formatted
- [ ] Categories are organized logically
- [ ] SEO metadata is complete

### Inventory
- [ ] Initial inventory counts are accurate
- [ ] Low stock thresholds are set
- [ ] Out-of-stock behavior is configured (deny vs allow oversell)
- [ ] Inventory alerts are configured

### Checkout
- [ ] Guest checkout works
- [ ] Registered user checkout works
- [ ] All payment methods tested
- [ ] Address validation works
- [ ] Tax calculation is accurate
- [ ] Shipping options display correctly
- [ ] Discount codes work
- [ ] Order confirmation emails send

### Post-Purchase
- [ ] Order confirmation page displays correctly
- [ ] Order history accessible to users
- [ ] Order status tracking works
- [ ] Fulfillment workflow is ready
- [ ] Return/refund process is documented

### Operations
- [ ] Low stock alerts configured
- [ ] Abandoned cart emails set up
- [ ] Order notification emails working
- [ ] Admin order management tested
- [ ] Reporting dashboard ready
```

---

## 📚 EDUCATION EXPERT PERSPECTIVE

When building educational applications, focus on learning outcomes,
progress tracking, and engagement mechanics.

### Education Database Schema

```typescript
// db/schema/education.ts
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, decimal } from 'drizzle-orm/pg-core';

// Courses
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  shortDescription: text('short_description'),
  thumbnail: text('thumbnail'),
  instructorId: uuid('instructor_id').notNull(),
  categoryId: uuid('category_id'),
  level: text('level').notNull(), // 'beginner', 'intermediate', 'advanced'
  status: text('status').default('draft').notNull(), // 'draft', 'published', 'archived'
  priceInCents: integer('price_in_cents'),
  isFree: boolean('is_free').default(false),
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  language: text('language').default('en'),
  certificateEnabled: boolean('certificate_enabled').default(false),
  prerequisites: jsonb('prerequisites').$type<string[]>(),
  learningObjectives: jsonb('learning_objectives').$type<string[]>(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Course Sections/Modules
export const courseSections = pgTable('course_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Lessons
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => courseSections.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  contentType: text('content_type').notNull(), // 'video', 'text', 'quiz', 'assignment'
  content: jsonb('content').$type<{
    // For video
    videoUrl?: string;
    videoProvider?: 'youtube' | 'vimeo' | 'mux' | 'cloudflare';
    videoDurationSeconds?: number;
    // For text
    textContent?: string; // Markdown
    // For quiz
    quizId?: string;
    // For assignment
    assignmentInstructions?: string;
    assignmentDueOffset?: number; // Days after enrollment
  }>(),
  durationMinutes: integer('duration_minutes'),
  isFreePreview: boolean('is_free_preview').default(false),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Enrollments
export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  courseId: uuid('course_id').notNull().references(() => courses.id),
  status: text('status').default('active').notNull(), // 'active', 'completed', 'expired', 'cancelled'
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // For time-limited access
  completedAt: timestamp('completed_at'),
  certificateIssuedAt: timestamp('certificate_issued_at'),
  certificateUrl: text('certificate_url'),
  progressPercentage: integer('progress_percentage').default(0),
  lastAccessedAt: timestamp('last_accessed_at'),
  // Payment info
  orderId: uuid('order_id'),
  paidAmountCents: integer('paid_amount_cents'),
});

// Lesson Progress
export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  status: text('status').default('not_started').notNull(), // 'not_started', 'in_progress', 'completed'
  progressData: jsonb('progress_data').$type<{
    videoWatchedSeconds?: number;
    videoLastPosition?: number;
    quizScore?: number;
    quizAttempts?: number;
    assignmentSubmittedAt?: string;
    assignmentGrade?: number;
  }>(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Quizzes
export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  passingScore: integer('passing_score').default(70), // Percentage
  timeLimit: integer('time_limit'), // Minutes, null for unlimited
  maxAttempts: integer('max_attempts'), // null for unlimited
  shuffleQuestions: boolean('shuffle_questions').default(false),
  showCorrectAnswers: boolean('show_correct_answers').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quiz Questions
export const quizQuestions = pgTable('quiz_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  questionType: text('question_type').notNull(), // 'multiple_choice', 'true_false', 'short_answer', 'matching'
  questionText: text('question_text').notNull(),
  options: jsonb('options').$type<Array<{
    id: string;
    text: string;
    isCorrect?: boolean;
  }>>(),
  correctAnswer: text('correct_answer'), // For short answer
  explanation: text('explanation'), // Show after answering
  points: integer('points').default(1),
  position: integer('position').notNull(),
});

// Quiz Attempts
export const quizAttempts = pgTable('quiz_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id),
  status: text('status').default('in_progress').notNull(), // 'in_progress', 'completed', 'timed_out'
  score: integer('score'), // Percentage
  pointsEarned: integer('points_earned'),
  pointsPossible: integer('points_possible'),
  answers: jsonb('answers').$type<Array<{
    questionId: string;
    answer: string | string[];
    isCorrect: boolean;
    pointsEarned: number;
  }>>(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  timeSpentSeconds: integer('time_spent_seconds'),
});

// Certificates
export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  courseId: uuid('course_id').notNull().references(() => courses.id),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id),
  certificateNumber: text('certificate_number').unique().notNull(),
  recipientName: text('recipient_name').notNull(),
  courseName: text('course_name').notNull(),
  instructorName: text('instructor_name').notNull(),
  completedAt: timestamp('completed_at').notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  pdfUrl: text('pdf_url'),
  verificationUrl: text('verification_url'),
});

// Discussion Forums
export const discussionThreads = pgTable('discussion_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),
  replyCount: integer('reply_count').default(0),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const discussionReplies = pgTable('discussion_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => discussionThreads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  content: text('content').notNull(),
  isInstructorReply: boolean('is_instructor_reply').default(false),
  parentReplyId: uuid('parent_reply_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Progress Tracking Service

```typescript
// services/education/progress-service.ts
import { db } from '@/db';
import { 
  enrollments, lessonProgress, lessons, courseSections, 
  courses, certificates 
} from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class ProgressService {
  /**
   * Mark lesson as started
   */
  static async startLesson(
    userId: string,
    lessonId: string,
    enrollmentId: string
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      )
      .limit(1);
    
    if (existing) {
      await db
        .update(lessonProgress)
        .set({ 
          status: existing.status === 'not_started' ? 'in_progress' : existing.status,
          startedAt: existing.startedAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lessonProgress.id, existing.id));
    } else {
      await db.insert(lessonProgress).values({
        userId,
        lessonId,
        enrollmentId,
        status: 'in_progress',
        startedAt: new Date(),
      });
    }
    
    // Update last accessed
    await db
      .update(enrollments)
      .set({ lastAccessedAt: new Date() })
      .where(eq(enrollments.id, enrollmentId));
  }
  
  /**
   * Complete a lesson
   */
  static async completeLesson(
    userId: string,
    lessonId: string,
    progressData?: Record<string, unknown>
  ): Promise<{ courseCompleted: boolean }> {
    // Update lesson progress
    await db
      .update(lessonProgress)
      .set({
        status: 'completed',
        completedAt: new Date(),
        progressData: progressData || {},
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      );
    
    // Get enrollment
    const [lesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);
    
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, lesson.courseId)
        )
      )
      .limit(1);
    
    // Calculate new progress percentage
    const progressPercentage = await this.calculateProgress(
      userId,
      lesson.courseId
    );
    
    await db
      .update(enrollments)
      .set({
        progressPercentage,
        lastAccessedAt: new Date(),
      })
      .where(eq(enrollments.id, enrollment.id));
    
    // Check if course is complete
    if (progressPercentage === 100) {
      await this.completeCourse(userId, lesson.courseId, enrollment.id);
      return { courseCompleted: true };
    }
    
    return { courseCompleted: false };
  }
  
  /**
   * Calculate overall course progress
   */
  static async calculateProgress(
    userId: string,
    courseId: string
  ): Promise<number> {
    // Count total lessons
    const totalLessons = await db
      .select({ count: count() })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));
    
    // Count completed lessons
    const completedLessons = await db
      .select({ count: count() })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(
        and(
          eq(lessons.courseId, courseId),
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.status, 'completed')
        )
      );
    
    const total = Number(totalLessons[0]?.count || 0);
    const completed = Number(completedLessons[0]?.count || 0);
    
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }
  
  /**
   * Complete course and issue certificate
   */
  static async completeCourse(
    userId: string,
    courseId: string,
    enrollmentId: string
  ): Promise<void> {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    
    // Update enrollment
    await db
      .update(enrollments)
      .set({
        status: 'completed',
        completedAt: new Date(),
        progressPercentage: 100,
      })
      .where(eq(enrollments.id, enrollmentId));
    
    // Issue certificate if enabled
    if (course.certificateEnabled) {
      await this.issueCertificate(userId, courseId, enrollmentId);
    }
  }
  
  /**
   * Issue course completion certificate
   */
  static async issueCertificate(
    userId: string,
    courseId: string,
    enrollmentId: string
  ): Promise<string> {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    
    // Get user details (you'd fetch from users table)
    const userName = 'Student Name'; // Fetch from user profile
    const instructorName = 'Instructor Name'; // Fetch from instructor profile
    
    const certificateNumber = `CERT-${nanoid(10).toUpperCase()}`;
    
    const [certificate] = await db.insert(certificates).values({
      userId,
      courseId,
      enrollmentId,
      certificateNumber,
      recipientName: userName,
      courseName: course.title,
      instructorName,
      completedAt: new Date(),
      verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/certificates/verify/${certificateNumber}`,
    }).returning();
    
    // Update enrollment
    await db
      .update(enrollments)
      .set({
        certificateIssuedAt: new Date(),
        certificateUrl: certificate.verificationUrl,
      })
      .where(eq(enrollments.id, enrollmentId));
    
    // Generate PDF (would integrate with PDF service)
    // await CertificateService.generatePDF(certificate.id);
    
    return certificate.certificateNumber;
  }
  
  /**
   * Get course progress details
   */
  static async getCourseProgress(userId: string, courseId: string) {
    const sections = await db
      .select()
      .from(courseSections)
      .where(eq(courseSections.courseId, courseId))
      .orderBy(courseSections.position);
    
    const lessonsWithProgress = await db
      .select({
        lesson: lessons,
        progress: lessonProgress,
      })
      .from(lessons)
      .leftJoin(
        lessonProgress,
        and(
          eq(lessonProgress.lessonId, lessons.id),
          eq(lessonProgress.userId, userId)
        )
      )
      .where(eq(lessons.courseId, courseId))
      .orderBy(lessons.position);
    
    // Group by section
    const progressBySection = sections.map(section => ({
      ...section,
      lessons: lessonsWithProgress
        .filter(l => l.lesson.sectionId === section.id)
        .map(l => ({
          ...l.lesson,
          status: l.progress?.status || 'not_started',
          completedAt: l.progress?.completedAt,
        })),
    }));
    
    return progressBySection;
  }
}
```

### Video Progress Tracking

```typescript
// services/education/video-progress-service.ts
import { db } from '@/db';
import { lessonProgress } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class VideoProgressService {
  /**
   * Update video watch progress
   * Call this periodically (every 10-30 seconds) while video plays
   */
  static async updateProgress(
    userId: string,
    lessonId: string,
    currentTime: number,
    duration: number
  ): Promise<void> {
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      )
      .limit(1);
    
    if (!progress) return;
    
    const existingData = (progress.progressData as Record<string, unknown>) || {};
    const watchedSeconds = Math.max(
      Number(existingData.videoWatchedSeconds || 0),
      currentTime
    );
    
    // Auto-complete if watched 90%+ of video
    const watchPercentage = (watchedSeconds / duration) * 100;
    const shouldComplete = watchPercentage >= 90 && progress.status !== 'completed';
    
    await db
      .update(lessonProgress)
      .set({
        progressData: {
          ...existingData,
          videoWatchedSeconds: watchedSeconds,
          videoLastPosition: currentTime,
        },
        status: shouldComplete ? 'completed' : progress.status,
        completedAt: shouldComplete ? new Date() : progress.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(lessonProgress.id, progress.id));
  }
  
  /**
   * Get resume position for video
   */
  static async getResumePosition(
    userId: string,
    lessonId: string
  ): Promise<number> {
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      )
      .limit(1);
    
    if (!progress) return 0;
    
    const data = progress.progressData as Record<string, unknown>;
    return Number(data?.videoLastPosition || 0);
  }
}
```

### Gamification Elements

```typescript
// services/education/gamification-service.ts
import { db } from '@/db';

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_LESSON: {
    id: 'first_lesson',
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon: '🎯',
    points: 10,
  },
  COURSE_COMPLETE: {
    id: 'course_complete',
    title: 'Graduate',
    description: 'Complete an entire course',
    icon: '🎓',
    points: 100,
  },
  STREAK_7: {
    id: 'streak_7',
    title: 'Week Warrior',
    description: 'Learn 7 days in a row',
    icon: '🔥',
    points: 50,
  },
  STREAK_30: {
    id: 'streak_30',
    title: 'Monthly Master',
    description: 'Learn 30 days in a row',
    icon: '💪',
    points: 200,
  },
  QUIZ_PERFECT: {
    id: 'quiz_perfect',
    title: 'Perfect Score',
    description: 'Score 100% on a quiz',
    icon: '💯',
    points: 25,
  },
  EARLY_BIRD: {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Complete a lesson before 7 AM',
    icon: '🌅',
    points: 15,
  },
  NIGHT_OWL: {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Complete a lesson after 11 PM',
    icon: '🦉',
    points: 15,
  },
};

export class GamificationService {
  /**
   * Check and award achievements
   */
  static async checkAchievements(
    userId: string,
    event: {
      type: 'lesson_complete' | 'course_complete' | 'quiz_complete';
      data: Record<string, unknown>;
    }
  ): Promise<string[]> {
    const awarded: string[] = [];
    
    switch (event.type) {
      case 'lesson_complete':
        // Check first lesson achievement
        const completedCount = await this.getCompletedLessonCount(userId);
        if (completedCount === 1) {
          await this.awardAchievement(userId, 'FIRST_LESSON');
          awarded.push('FIRST_LESSON');
        }
        
        // Check time-based achievements
        const hour = new Date().getHours();
        if (hour < 7) {
          const hasEarlyBird = await this.hasAchievement(userId, 'EARLY_BIRD');
          if (!hasEarlyBird) {
            await this.awardAchievement(userId, 'EARLY_BIRD');
            awarded.push('EARLY_BIRD');
          }
        } else if (hour >= 23) {
          const hasNightOwl = await this.hasAchievement(userId, 'NIGHT_OWL');
          if (!hasNightOwl) {
            await this.awardAchievement(userId, 'NIGHT_OWL');
            awarded.push('NIGHT_OWL');
          }
        }
        break;
        
      case 'course_complete':
        await this.awardAchievement(userId, 'COURSE_COMPLETE');
        awarded.push('COURSE_COMPLETE');
        break;
        
      case 'quiz_complete':
        if (event.data.score === 100) {
          const hasPerfect = await this.hasAchievement(userId, 'QUIZ_PERFECT');
          if (!hasPerfect) {
            await this.awardAchievement(userId, 'QUIZ_PERFECT');
            awarded.push('QUIZ_PERFECT');
          }
        }
        break;
    }
    
    // Check streak achievements
    const streak = await this.getCurrentStreak(userId);
    if (streak >= 7) {
      const hasStreak7 = await this.hasAchievement(userId, 'STREAK_7');
      if (!hasStreak7) {
        await this.awardAchievement(userId, 'STREAK_7');
        awarded.push('STREAK_7');
      }
    }
    if (streak >= 30) {
      const hasStreak30 = await this.hasAchievement(userId, 'STREAK_30');
      if (!hasStreak30) {
        await this.awardAchievement(userId, 'STREAK_30');
        awarded.push('STREAK_30');
      }
    }
    
    return awarded;
  }
  
  /**
   * Award achievement to user
   */
  static async awardAchievement(
    userId: string,
    achievementKey: keyof typeof ACHIEVEMENTS
  ): Promise<void> {
    const achievement = ACHIEVEMENTS[achievementKey];
    // Insert into user_achievements table
    // Add points to user
    console.log(`Awarded ${achievement.title} to user ${userId}`);
  }
  
  /**
   * Check if user has achievement
   */
  static async hasAchievement(
    userId: string,
    achievementKey: string
  ): Promise<boolean> {
    // Check user_achievements table
    return false;
  }
  
  /**
   * Get completed lesson count
   */
  static async getCompletedLessonCount(userId: string): Promise<number> {
    // Query lesson_progress
    return 0;
  }
  
  /**
   * Get current learning streak
   */
  static async getCurrentStreak(userId: string): Promise<number> {
    // Calculate consecutive days with activity
    return 0;
  }
  
  /**
   * Get user's total points
   */
  static async getUserPoints(userId: string): Promise<number> {
    // Sum points from achievements
    return 0;
  }
  
  /**
   * Get leaderboard
   */
  static async getLeaderboard(limit: number = 10) {
    // Return top users by points
    return [];
  }
}
```

---

## 🎤 VOICE & VAPI EXPERT PERSPECTIVE

When building voice applications, focus on conversational design,
latency optimization, and natural language understanding.

### VAPI Integration Schema

```typescript
// db/schema/voice.ts
import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';

// Voice Agents
export const voiceAgents = pgTable('voice_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  vapiAssistantId: text('vapi_assistant_id'), // ID from VAPI
  status: text('status').default('draft').notNull(), // 'draft', 'active', 'paused'
  
  // Voice settings
  voiceProvider: text('voice_provider').default('elevenlabs'), // 'elevenlabs', 'playht', 'deepgram'
  voiceId: text('voice_id').notNull(),
  voiceSettings: jsonb('voice_settings').$type<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakingRate?: number;
  }>(),
  
  // Model settings
  model: text('model').default('gpt-4'), // 'gpt-4', 'gpt-3.5-turbo', 'claude-3'
  systemPrompt: text('system_prompt').notNull(),
  firstMessage: text('first_message'),
  
  // Call settings
  maxCallDuration: integer('max_call_duration').default(300), // seconds
  silenceTimeout: integer('silence_timeout').default(30), // seconds
  interruptionThreshold: integer('interruption_threshold').default(100), // ms
  
  // Phone settings
  phoneNumberId: uuid('phone_number_id'),
  
  // Analytics
  totalCalls: integer('total_calls').default(0),
  totalMinutes: integer('total_minutes').default(0),
  avgCallDuration: integer('avg_call_duration'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Phone Numbers
export const phoneNumbers = pgTable('phone_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  number: text('number').notNull(), // E.164 format
  provider: text('provider').notNull(), // 'twilio', 'vapi'
  providerId: text('provider_id'), // ID from provider
  status: text('status').default('active').notNull(),
  assignedAgentId: uuid('assigned_agent_id').references(() => voiceAgents.id),
  monthlyFee: integer('monthly_fee'), // cents
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Call Logs
export const callLogs = pgTable('call_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => voiceAgents.id),
  organizationId: uuid('organization_id').notNull(),
  vapiCallId: text('vapi_call_id'),
  
  // Call details
  direction: text('direction').notNull(), // 'inbound', 'outbound'
  fromNumber: text('from_number'),
  toNumber: text('to_number'),
  status: text('status').notNull(), // 'queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer'
  endedReason: text('ended_reason'), // 'completed', 'hangup', 'error', 'timeout', 'transfer'
  
  // Timing
  startedAt: timestamp('started_at'),
  answeredAt: timestamp('answered_at'),
  endedAt: timestamp('ended_at'),
  durationSeconds: integer('duration_seconds'),
  
  // Content
  transcript: text('transcript'),
  summary: text('summary'),
  recordingUrl: text('recording_url'),
  
  // Analysis
  sentiment: text('sentiment'), // 'positive', 'neutral', 'negative'
  intent: text('intent'), // Detected user intent
  outcome: text('outcome'), // 'success', 'partial', 'failed'
  
  // Extracted data
  extractedData: jsonb('extracted_data').$type<Record<string, unknown>>(),
  
  // Cost
  costCents: integer('cost_cents'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Conversation Messages (for detailed transcript)
export const callMessages = pgTable('call_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  callId: uuid('call_id').notNull().references(() => callLogs.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  durationMs: integer('duration_ms'),
  toolCalls: jsonb('tool_calls').$type<Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>>(),
});

// Function/Tool Definitions
export const agentTools = pgTable('agent_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => voiceAgents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  parameters: jsonb('parameters').$type<{
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  }>().notNull(),
  endpoint: text('endpoint'), // Webhook URL
  method: text('method').default('POST'),
  headers: jsonb('headers').$type<Record<string, string>>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### VAPI Service Integration

```typescript
// services/voice/vapi-service.ts

interface VapiConfig {
  apiKey: string;
  baseUrl?: string;
}

interface CreateAssistantParams {
  name: string;
  model: {
    provider: 'openai' | 'anthropic';
    model: string;
    systemPrompt: string;
    temperature?: number;
  };
  voice: {
    provider: 'elevenlabs' | 'playht' | 'deepgram';
    voiceId: string;
    settings?: Record<string, number>;
  };
  firstMessage?: string;
  functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    serverUrl?: string;
  }>;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
}

export class VapiService {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(config: VapiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.vapi.ai';
  }
  
  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API error: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Create a new assistant
   */
  async createAssistant(params: CreateAssistantParams) {
    return this.request('POST', '/assistant', {
      name: params.name,
      model: {
        provider: params.model.provider,
        model: params.model.model,
        messages: [
          {
            role: 'system',
            content: params.model.systemPrompt,
          },
        ],
        temperature: params.model.temperature || 0.7,
      },
      voice: {
        provider: params.voice.provider,
        voiceId: params.voice.voiceId,
        ...params.voice.settings,
      },
      firstMessage: params.firstMessage,
      functions: params.functions,
      silenceTimeoutSeconds: params.silenceTimeoutSeconds || 30,
      maxDurationSeconds: params.maxDurationSeconds || 300,
    });
  }
  
  /**
   * Update assistant
   */
  async updateAssistant(assistantId: string, params: Partial<CreateAssistantParams>) {
    return this.request('PATCH', `/assistant/${assistantId}`, params);
  }
  
  /**
   * Delete assistant
   */
  async deleteAssistant(assistantId: string) {
    return this.request('DELETE', `/assistant/${assistantId}`);
  }
  
  /**
   * Make outbound call
   */
  async makeCall(params: {
    assistantId: string;
    phoneNumberId: string;
    customerNumber: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request('POST', '/call/phone', {
      assistantId: params.assistantId,
      phoneNumberId: params.phoneNumberId,
      customer: {
        number: params.customerNumber,
      },
      metadata: params.metadata,
    });
  }
  
  /**
   * Get call details
   */
  async getCall(callId: string) {
    return this.request('GET', `/call/${callId}`);
  }
  
  /**
   * List calls
   */
  async listCalls(params?: {
    assistantId?: string;
    limit?: number;
    createdAtGt?: string;
    createdAtLt?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.assistantId) query.set('assistantId', params.assistantId);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.createdAtGt) query.set('createdAtGt', params.createdAtGt);
    if (params?.createdAtLt) query.set('createdAtLt', params.createdAtLt);
    
    return this.request('GET', `/call?${query.toString()}`);
  }
  
  /**
   * Import phone number
   */
  async importPhoneNumber(params: {
    provider: 'twilio';
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioPhoneNumber: string;
  }) {
    return this.request('POST', '/phone-number/import', params);
  }
}

// Singleton instance
export const vapi = new VapiService({
  apiKey: process.env.VAPI_API_KEY!,
});
```

### VAPI Webhook Handler

```typescript
// app/api/webhooks/vapi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { callLogs, callMessages, voiceAgents } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Verify VAPI webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-vapi-signature');
  
  // Verify signature
  if (process.env.VAPI_WEBHOOK_SECRET && signature) {
    const isValid = verifyWebhookSignature(
      body,
      signature,
      process.env.VAPI_WEBHOOK_SECRET
    );
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }
  
  const event = JSON.parse(body);
  
  try {
    switch (event.message.type) {
      case 'call-started':
        await handleCallStarted(event);
        break;
        
      case 'speech-update':
        await handleSpeechUpdate(event);
        break;
        
      case 'transcript':
        await handleTranscript(event);
        break;
        
      case 'function-call':
        return await handleFunctionCall(event);
        
      case 'call-ended':
        await handleCallEnded(event);
        break;
        
      case 'end-of-call-report':
        await handleEndOfCallReport(event);
        break;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('VAPI webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCallStarted(event: any) {
  const { call } = event.message;
  
  // Find agent by VAPI assistant ID
  const [agent] = await db
    .select()
    .from(voiceAgents)
    .where(eq(voiceAgents.vapiAssistantId, call.assistantId))
    .limit(1);
  
  if (!agent) {
    console.warn(`Agent not found for assistant ${call.assistantId}`);
    return;
  }
  
  // Create call log
  await db.insert(callLogs).values({
    agentId: agent.id,
    organizationId: agent.organizationId,
    vapiCallId: call.id,
    direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
    fromNumber: call.customer?.number,
    toNumber: call.phoneNumber?.number,
    status: 'in-progress',
    startedAt: new Date(),
    metadata: call.metadata,
  });
}

async function handleSpeechUpdate(event: any) {
  // Real-time speech detection - can be used for live UI updates
  const { call, message } = event;
  console.log(`Speech ${message.status} for call ${call.id}`);
}

async function handleTranscript(event: any) {
  const { call, message } = event;
  
  // Find call log
  const [callLog] = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.vapiCallId, call.id))
    .limit(1);
  
  if (!callLog) return;
  
  // Save message
  await db.insert(callMessages).values({
    callId: callLog.id,
    role: message.role,
    content: message.transcript,
    timestamp: new Date(message.timestamp),
  });
}

async function handleFunctionCall(event: any) {
  const { message } = event;
  const functionName = message.functionCall.name;
  const args = message.functionCall.parameters;
  
  // Route to appropriate handler
  let result: unknown;
  
  switch (functionName) {
    case 'book_appointment':
      result = await bookAppointment(args);
      break;
      
    case 'check_availability':
      result = await checkAvailability(args);
      break;
      
    case 'transfer_call':
      result = await transferCall(args);
      break;
      
    case 'lookup_customer':
      result = await lookupCustomer(args);
      break;
      
    default:
      result = { error: `Unknown function: ${functionName}` };
  }
  
  return NextResponse.json({ result });
}

async function handleCallEnded(event: any) {
  const { call } = event.message;
  
  await db
    .update(callLogs)
    .set({
      status: 'completed',
      endedAt: new Date(),
      endedReason: call.endedReason,
    })
    .where(eq(callLogs.vapiCallId, call.id));
}

async function handleEndOfCallReport(event: any) {
  const { call, message } = event;
  
  await db
    .update(callLogs)
    .set({
      transcript: message.transcript,
      summary: message.summary,
      recordingUrl: message.recordingUrl,
      durationSeconds: Math.round((message.endedAt - message.startedAt) / 1000),
      costCents: Math.round(message.cost * 100),
    })
    .where(eq(callLogs.vapiCallId, call.id));
  
  // Update agent stats
  const [callLog] = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.vapiCallId, call.id))
    .limit(1);
  
  if (callLog) {
    await db
      .update(voiceAgents)
      .set({
        totalCalls: sql`total_calls + 1`,
        totalMinutes: sql`total_minutes + ${Math.ceil(callLog.durationSeconds / 60)}`,
      })
      .where(eq(voiceAgents.id, callLog.agentId));
  }
}

// Function implementations
async function bookAppointment(args: { date: string; time: string; service: string }) {
  // Integrate with calendar/booking system
  return { success: true, confirmationNumber: 'APT-12345' };
}

async function checkAvailability(args: { date: string; service?: string }) {
  // Check calendar availability
  return { available: true, slots: ['9:00 AM', '10:00 AM', '2:00 PM'] };
}

async function transferCall(args: { department: string }) {
  // Return transfer number
  const transfers: Record<string, string> = {
    sales: '+1234567890',
    support: '+1234567891',
    billing: '+1234567892',
  };
  return { transferNumber: transfers[args.department] || transfers.support };
}

async function lookupCustomer(args: { phoneNumber: string }) {
  // Look up customer in database
  return { name: 'John Doe', accountId: 'CUST-123', tier: 'premium' };
}
```

### Voice Agent Prompt Template

```typescript
// Voice agent system prompt template
export function generateAgentPrompt(config: {
  businessName: string;
  businessType: string;
  agentName: string;
  primaryGoal: string;
  services?: string[];
  hoursOfOperation?: string;
  transferNumber?: string;
  customInstructions?: string;
}): string {
  return `You are ${config.agentName}, a professional voice assistant for ${config.businessName}, a ${config.businessType}.

## YOUR ROLE
${config.primaryGoal}

## CONVERSATION GUIDELINES
1. Be warm, professional, and conversational
2. Keep responses brief (1-2 sentences when possible)
3. Use natural speech patterns, including occasional filler words like "um" or "let me see"
4. Ask clarifying questions rather than making assumptions
5. Confirm important details before taking action

## BUSINESS INFORMATION
${config.services ? `Services offered: ${config.services.join(', ')}` : ''}
${config.hoursOfOperation ? `Hours of operation: ${config.hoursOfOperation}` : ''}

## HANDLING COMMON SCENARIOS

### Scheduling
- Always confirm date, time, and service type
- Offer alternatives if requested time is unavailable
- Summarize the booking before confirming

### Questions You Can't Answer
- Say "That's a great question. Let me transfer you to someone who can help with that."
- Use the transfer_call function with appropriate department

### Angry or Frustrated Callers
- Acknowledge their frustration: "I understand this is frustrating"
- Focus on resolution, not blame
- Offer to escalate if needed

### Ending Calls
- Summarize what was accomplished
- Confirm any next steps
- Thank them for calling

${config.customInstructions ? `## ADDITIONAL INSTRUCTIONS\n${config.customInstructions}` : ''}

Remember: You are a voice assistant, not a chatbot. Speak naturally and conversationally.`;
}
```

---

## 🏢 B2B EXPERT PERSPECTIVE

When building B2B applications, focus on multi-tenancy,
role-based access, and enterprise requirements.

### Multi-Tenant Schema

```typescript
// db/schema/b2b.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

// Organizations (Tenants)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(), // For subdomain routing
  domain: text('domain').unique(), // Custom domain
  logo: text('logo'),
  settings: jsonb('settings').$type<{
    branding?: {
      primaryColor?: string;
      logo?: string;
      favicon?: string;
    };
    features?: {
      ssoEnabled?: boolean;
      apiAccessEnabled?: boolean;
      auditLogEnabled?: boolean;
    };
    limits?: {
      maxUsers?: number;
      maxStorage?: number;
      maxApiCalls?: number;
    };
  }>(),
  subscriptionTier: text('subscription_tier').default('free'), // 'free', 'pro', 'enterprise'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organization Members
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull(), // 'owner', 'admin', 'member', 'viewer'
  title: text('title'), // Job title
  department: text('department'),
  invitedBy: uuid('invited_by'),
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at').defaultNow(),
  lastActiveAt: timestamp('last_active_at'),
});

// Invitations
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  token: text('token').unique().notNull(),
  invitedBy: uuid('invited_by').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Teams (within organization)
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  parentTeamId: uuid('parent_team_id').references(() => teams.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => organizationMembers.id, { onDelete: 'cascade' }),
  role: text('role').default('member'), // 'lead', 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// API Keys (for integrations)
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for display
  keyHash: text('key_hash').notNull(), // Hashed full key
  scopes: jsonb('scopes').$type<string[]>().default([]),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

// Audit Log
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id'),
  action: text('action').notNull(), // 'user.created', 'settings.updated', etc.
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Usage Tracking
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  metricType: text('metric_type').notNull(), // 'api_calls', 'storage', 'users', etc.
  quantity: integer('quantity').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Role-Based Access Control (RBAC)

```typescript
// lib/rbac/permissions.ts

// Define all permissions
export const PERMISSIONS = {
  // Organization
  'org:read': 'View organization details',
  'org:update': 'Update organization settings',
  'org:delete': 'Delete organization',
  'org:billing': 'Manage billing',
  
  // Members
  'members:read': 'View members',
  'members:invite': 'Invite new members',
  'members:update': 'Update member roles',
  'members:remove': 'Remove members',
  
  // Teams
  'teams:read': 'View teams',
  'teams:create': 'Create teams',
  'teams:update': 'Update teams',
  'teams:delete': 'Delete teams',
  
  // Projects (example resource)
  'projects:read': 'View projects',
  'projects:create': 'Create projects',
  'projects:update': 'Update projects',
  'projects:delete': 'Delete projects',
  
  // API Keys
  'api_keys:read': 'View API keys',
  'api_keys:create': 'Create API keys',
  'api_keys:revoke': 'Revoke API keys',
  
  // Audit
  'audit:read': 'View audit logs',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Define roles and their permissions
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.keys(PERMISSIONS) as Permission[], // All permissions
  
  admin: [
    'org:read',
    'org:update',
    'members:read',
    'members:invite',
    'members:update',
    'members:remove',
    'teams:read',
    'teams:create',
    'teams:update',
    'teams:delete',
    'projects:read',
    'projects:create',
    'projects:update',
    'projects:delete',
    'api_keys:read',
    'api_keys:create',
    'api_keys:revoke',
    'audit:read',
  ],
  
  member: [
    'org:read',
    'members:read',
    'teams:read',
    'projects:read',
    'projects:create',
    'projects:update',
  ],
  
  viewer: [
    'org:read',
    'members:read',
    'teams:read',
    'projects:read',
  ],
};

// Permission checker
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

// Middleware helper
export function requirePermission(permission: Permission) {
  return async (req: Request, ctx: { params: { orgId: string } }) => {
    const session = await getSession();
    if (!session?.user) {
      throw new Error('Unauthorized');
    }
    
    const membership = await getMembership(session.user.id, ctx.params.orgId);
    if (!membership) {
      throw new Error('Not a member of this organization');
    }
    
    if (!hasPermission(membership.role, permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
    
    return { membership, session };
  };
}
```

### SSO Integration (SAML)

```typescript
// services/b2b/sso-service.ts

interface SAMLConfig {
  entryPoint: string; // IdP SSO URL
  issuer: string; // SP Entity ID
  cert: string; // IdP Certificate
  callbackUrl: string; // SP ACS URL
}

export class SSOService {
  /**
   * Configure SAML for organization
   */
  static async configureSAML(
    organizationId: string,
    config: SAMLConfig
  ): Promise<void> {
    await db
      .update(organizations)
      .set({
        settings: sql`jsonb_set(
          COALESCE(settings, '{}'),
          '{sso}',
          ${JSON.stringify({
            provider: 'saml',
            entryPoint: config.entryPoint,
            issuer: config.issuer,
            cert: config.cert,
            callbackUrl: config.callbackUrl,
            enabled: true,
          })}
        )`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));
  }
  
  /**
   * Generate SP metadata
   */
  static generateSPMetadata(organizationSlug: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const acsUrl = `${baseUrl}/api/auth/saml/${organizationSlug}/callback`;
    const entityId = `${baseUrl}/api/auth/saml/${organizationSlug}/metadata`;
    
    return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false"
                   WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${acsUrl}"
                              index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }
  
  /**
   * Initiate SAML login
   */
  static async initiateLogin(organizationSlug: string): Promise<string> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, organizationSlug))
      .limit(1);
    
    if (!org?.settings?.sso?.enabled) {
      throw new Error('SSO not configured for this organization');
    }
    
    const sso = org.settings.sso;
    const requestId = `_${nanoid()}`;
    const issueInstant = new Date().toISOString();
    
    const samlRequest = `<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${sso.entryPoint}"
  AssertionConsumerServiceURL="${sso.callbackUrl}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
    ${sso.issuer}
  </saml:Issuer>
</samlp:AuthnRequest>`;
    
    const encoded = Buffer.from(samlRequest).toString('base64');
    return `${sso.entryPoint}?SAMLRequest=${encodeURIComponent(encoded)}`;
  }
}
```

### API Key Management

```typescript
// services/b2b/api-key-service.ts
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';

export class ApiKeyService {
  /**
   * Generate new API key
   * Returns the full key only once - store it securely!
   */
  static async createApiKey(
    organizationId: string,
    name: string,
    scopes: string[],
    createdBy: string,
    expiresAt?: Date
  ): Promise<{ id: string; key: string; prefix: string }> {
    // Generate a secure random key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.substring(0, 8);
    const keyHash = crypto
      .createHash('sha256')
      .update(rawKey)
      .digest('hex');
    
    const [created] = await db.insert(apiKeys).values({
      organizationId,
      name,
      keyPrefix: prefix,
      keyHash,
      scopes,
      createdBy,
      expiresAt,
    }).returning();
    
    // Return full key - this is the only time it's available!
    return {
      id: created.id,
      key: `sk_live_${rawKey}`,
      prefix,
    };
  }
  
  /**
   * Validate API key
   */
  static async validateApiKey(
    key: string
  ): Promise<{
    valid: boolean;
    organizationId?: string;
    scopes?: string[];
    error?: string;
  }> {
    // Extract raw key from prefixed format
    if (!key.startsWith('sk_live_')) {
      return { valid: false, error: 'Invalid key format' };
    }
    
    const rawKey = key.replace('sk_live_', '');
    const keyHash = crypto
      .createHash('sha256')
      .update(rawKey)
      .digest('hex');
    
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);
    
    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }
    
    // Update last used
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));
    
    return {
      valid: true,
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes as string[],
    };
  }
  
  /**
   * Revoke API key
   */
  static async revokeApiKey(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, keyId));
  }
  
  /**
   * List organization's API keys
   */
  static async listApiKeys(organizationId: string) {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, organizationId))
      .orderBy(apiKeys.createdAt);
  }
}
```

---

## 👶 KIDS & COPPA EXPERT PERSPECTIVE

When building applications for children under 13, COPPA compliance is mandatory.
Failure to comply can result in significant FTC penalties.

### COPPA Compliance Requirements

```typescript
// lib/coppa/requirements.ts

/**
 * COPPA (Children's Online Privacy Protection Act) applies when:
 * 1. Your service is directed to children under 13
 * 2. You have actual knowledge that users are under 13
 * 3. You collect personal information from children
 * 
 * Personal information under COPPA includes:
 * - Full name
 * - Home address
 * - Email address
 * - Phone number
 * - Social Security number
 * - Photo, video, or audio with child's image/voice
 * - Geolocation data
 * - Persistent identifiers (cookies, device IDs) when used to track
 */

export const COPPA_REQUIREMENTS = {
  // Required notices
  notices: {
    privacyPolicy: {
      required: true,
      mustInclude: [
        'Types of personal information collected',
        'How information is used',
        'Disclosure practices',
        'Parental rights (access, delete, refuse further collection)',
        'Contact information for privacy inquiries',
      ],
    },
    directNotice: {
      required: true,
      when: 'Before collecting any personal information',
      mustInclude: [
        'What information will be collected',
        'How it will be used',
        'Request for verifiable parental consent',
      ],
    },
  },
  
  // Parental consent requirements
  parentalConsent: {
    required: true,
    verificationMethods: [
      'Signed consent form (mail/fax)',
      'Credit card transaction',
      'Video conference call',
      'Government ID check',
      'Knowledge-based authentication',
    ],
    // For internal use only (no disclosure to third parties):
    emailPlusVerification: {
      allowed: true,
      steps: [
        'Send email to parent',
        'Require confirmation response',
        'Follow up with email asking parent to confirm or revoke',
      ],
    },
  },
  
  // Data handling
  dataHandling: {
    minimization: 'Collect only what is reasonably necessary',
    retention: 'Keep only as long as reasonably necessary',
    security: 'Reasonable procedures to protect confidentiality',
    thirdParties: 'Service providers must maintain confidentiality',
  },
  
  // Parent rights
  parentalRights: [
    'Review personal information collected',
    'Refuse further collection',
    'Request deletion of information',
    'Consent to collection without disclosure',
  ],
};
```

### COPPA-Compliant Schema

```typescript
// db/schema/coppa.ts
import { pgTable, uuid, text, timestamp, boolean, date, jsonb } from 'drizzle-orm/pg-core';

// Child accounts (under 13)
export const childAccounts = pgTable('child_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(), // No real names!
  displayName: text('display_name'), // Can be nickname/avatar name
  birthDate: date('birth_date').notNull(), // For age verification
  avatarId: text('avatar_id'), // Predefined avatar, no uploads
  
  // Parent link
  parentAccountId: uuid('parent_account_id').notNull(),
  parentConsentVerified: boolean('parent_consent_verified').default(false),
  consentMethod: text('consent_method'), // How consent was verified
  consentVerifiedAt: timestamp('consent_verified_at'),
  
  // Privacy settings (parent-controlled)
  settings: jsonb('settings').$type<{
    canChat: boolean; // Enable/disable chat
    chatFilter: 'strict' | 'moderate'; // Profanity filter level
    canShareContent: boolean; // Can share creations
    canReceiveFriendRequests: boolean;
    screenTimeLimit?: number; // Minutes per day
  }>().default({
    canChat: false,
    chatFilter: 'strict',
    canShareContent: false,
    canReceiveFriendRequests: false,
  }),
  
  status: text('status').default('pending_consent'), // 'pending_consent', 'active', 'suspended'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Parent accounts
export const parentAccounts = pgTable('parent_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  
  // Consent tracking
  privacyPolicyAcceptedAt: timestamp('privacy_policy_accepted_at'),
  privacyPolicyVersion: text('privacy_policy_version'),
  
  // Verification
  emailVerified: boolean('email_verified').default(false),
  identityVerified: boolean('identity_verified').default(false),
  verificationMethod: text('verification_method'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Parental consent records (audit trail)
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id),
  childAccountId: uuid('child_account_id').notNull().references(() => childAccounts.id),
  
  // Consent details
  consentType: text('consent_type').notNull(), // 'initial', 'update', 'revoke'
  consentScope: jsonb('consent_scope').$type<{
    collection: string[]; // What data can be collected
    usage: string[]; // How data can be used
    disclosure: string[]; // Who data can be shared with
  }>().notNull(),
  
  // Verification
  verificationMethod: text('verification_method').notNull(),
  verificationDetails: jsonb('verification_details').$type<{
    transactionId?: string;
    signatureUrl?: string;
    idCheckId?: string;
  }>(),
  
  // IP for audit
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Some consent may expire
  revokedAt: timestamp('revoked_at'),
});

// Parent data requests (COPPA requirement)
export const parentDataRequests = pgTable('parent_data_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentAccountId: uuid('parent_account_id').notNull().references(() => parentAccounts.id),
  childAccountId: uuid('child_account_id').notNull().references(() => childAccounts.id),
  
  requestType: text('request_type').notNull(), // 'access', 'delete', 'stop_collection'
  status: text('status').default('pending').notNull(), // 'pending', 'processing', 'completed', 'denied'
  
  // Identity verification (must verify parent before fulfilling)
  identityVerified: boolean('identity_verified').default(false),
  verificationMethod: text('verification_method'),
  
  // Response
  responseData: jsonb('response_data'), // For access requests
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Age Gate Implementation

```typescript
// components/age-gate.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AgeGate() {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState({ month: '', day: '', year: '' });
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const { month, day, year } = birthDate;
    if (!month || !day || !year) {
      setError('Please enter your complete birth date');
      return;
    }
    
    const birth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    if (age < 13) {
      // Under 13 - redirect to parent signup flow
      router.push('/signup/parent?child_dob=' + encodeURIComponent(`${year}-${month}-${day}`));
    } else {
      // 13 or older - proceed to normal signup
      router.push('/signup');
    }
  };
  
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Enter Your Birthday</h1>
      <p className="text-gray-600 mb-6">
        We need to know your age to give you the right experience.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Month</label>
            <select
              value={birthDate.month}
              onChange={(e) => setBirthDate({ ...birthDate, month: e.target.value })}
              className="w-full border rounded-md p-2"
            >
              <option value="">Month</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Day</label>
            <select
              value={birthDate.day}
              onChange={(e) => setBirthDate({ ...birthDate, day: e.target.value })}
              className="w-full border rounded-md p-2"
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Year</label>
            <select
              value={birthDate.year}
              onChange={(e) => setBirthDate({ ...birthDate, year: e.target.value })}
              className="w-full border rounded-md p-2"
            >
              <option value="">Year</option>
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
        >
          Continue
        </button>
      </form>
      
      <p className="text-xs text-gray-500 mt-4">
        We use your birthday to ensure you get the right experience and comply
        with privacy laws. See our <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>
    </div>
  );
}
```

### Parental Consent Flow

```typescript
// services/coppa/consent-service.ts
import { db } from '@/db';
import { parentAccounts, childAccounts, consentRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { EmailService } from '@/services/email-service';
import { nanoid } from 'nanoid';

export class COPPAConsentService {
  /**
   * Start parental consent process
   */
  static async initiateConsent(
    parentEmail: string,
    childUsername: string,
    childBirthDate: Date
  ): Promise<{ parentId: string; childId: string; verificationCode: string }> {
    // Create parent account (unverified)
    const [parent] = await db.insert(parentAccounts).values({
      email: parentEmail,
      passwordHash: '', // Set during email verification
      name: '',
    }).returning();
    
    // Create child account (pending consent)
    const [child] = await db.insert(childAccounts).values({
      username: childUsername,
      birthDate: childBirthDate,
      parentAccountId: parent.id,
      status: 'pending_consent',
    }).returning();
    
    // Generate verification code
    const verificationCode = nanoid(6).toUpperCase();
    
    // Send email to parent
    await EmailService.send({
      to: parentEmail,
      templateId: 'coppa-consent-request',
      data: {
        childUsername,
        verificationCode,
        consentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/parent/consent?code=${verificationCode}`,
        privacyPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/privacy-children`,
      },
    });
    
    return { parentId: parent.id, childId: child.id, verificationCode };
  }
  
  /**
   * Verify parental consent via email confirmation
   * (Email Plus method - for internal use only)
   */
  static async verifyConsentViaEmail(
    verificationCode: string,
    parentEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    // Validate code matches parent
    // This is a simplified version - in production, store codes securely
    
    const [parent] = await db
      .select()
      .from(parentAccounts)
      .where(eq(parentAccounts.email, parentEmail))
      .limit(1);
    
    if (!parent) {
      return { success: false, error: 'Parent account not found' };
    }
    
    // Update parent verification
    await db
      .update(parentAccounts)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(parentAccounts.id, parent.id));
    
    // Get associated child accounts
    const children = await db
      .select()
      .from(childAccounts)
      .where(eq(childAccounts.parentAccountId, parent.id));
    
    // Activate child accounts and record consent
    for (const child of children) {
      await db
        .update(childAccounts)
        .set({
          status: 'active',
          parentConsentVerified: true,
          consentMethod: 'email_plus',
          consentVerifiedAt: new Date(),
        })
        .where(eq(childAccounts.id, child.id));
      
      // Create consent record
      await db.insert(consentRecords).values({
        parentAccountId: parent.id,
        childAccountId: child.id,
        consentType: 'initial',
        consentScope: {
          collection: ['username', 'avatar_selection', 'game_progress'],
          usage: ['provide_service', 'improve_service'],
          disclosure: [], // No third-party disclosure
        },
        verificationMethod: 'email_plus',
      });
    }
    
    // IMPORTANT: Send follow-up email for email+ method
    await EmailService.send({
      to: parentEmail,
      templateId: 'coppa-consent-confirmation',
      data: {
        revokeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/parent/dashboard`,
        supportEmail: 'privacy@example.com',
      },
    });
    
    return { success: true };
  }
  
  /**
   * Handle parent data access request
   */
  static async handleAccessRequest(
    parentId: string,
    childId: string
  ): Promise<Record<string, unknown>> {
    // Verify parent-child relationship
    const [child] = await db
      .select()
      .from(childAccounts)
      .where(
        and(
          eq(childAccounts.id, childId),
          eq(childAccounts.parentAccountId, parentId)
        )
      )
      .limit(1);
    
    if (!child) {
      throw new Error('Child account not found or not associated with parent');
    }
    
    // Collect all data associated with child
    // This should include ALL personal information
    const data = {
      account: {
        username: child.username,
        displayName: child.displayName,
        birthDate: child.birthDate,
        createdAt: child.createdAt,
      },
      // Add other data collections here
      // gameProgress: await getGameProgress(childId),
      // chatMessages: await getChatHistory(childId),
      // creations: await getCreations(childId),
    };
    
    return data;
  }
  
  /**
   * Handle parent deletion request
   */
  static async handleDeletionRequest(
    parentId: string,
    childId: string
  ): Promise<void> {
    // Verify parent-child relationship
    const [child] = await db
      .select()
      .from(childAccounts)
      .where(
        and(
          eq(childAccounts.id, childId),
          eq(childAccounts.parentAccountId, parentId)
        )
      )
      .limit(1);
    
    if (!child) {
      throw new Error('Child account not found or not associated with parent');
    }
    
    // Delete all child data
    // This should be a comprehensive deletion
    
    // 1. Delete game progress
    // await deleteGameProgress(childId);
    
    // 2. Delete chat history
    // await deleteChatHistory(childId);
    
    // 3. Delete creations
    // await deleteCreations(childId);
    
    // 4. Delete the child account
    await db
      .delete(childAccounts)
      .where(eq(childAccounts.id, childId));
    
    // 5. Log the deletion for compliance
    console.log(`COPPA deletion completed for child ${childId} by parent ${parentId}`);
  }
  
  /**
   * Handle stop collection request
   */
  static async handleStopCollectionRequest(
    parentId: string,
    childId: string
  ): Promise<void> {
    // Update consent to revoked
    await db.insert(consentRecords).values({
      parentAccountId: parentId,
      childAccountId: childId,
      consentType: 'revoke',
      consentScope: {
        collection: [],
        usage: [],
        disclosure: [],
      },
      verificationMethod: 'parent_dashboard',
    });
    
    // Suspend child account
    await db
      .update(childAccounts)
      .set({
        status: 'suspended',
        parentConsentVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(childAccounts.id, childId));
  }
}
```

### Chat Safety for Kids

```typescript
// services/coppa/chat-safety.ts

// List of predefined safe phrases for younger kids
const SAFE_PHRASES = [
  'Hi!',
  'Good game!',
  'Want to play?',
  'Nice!',
  'Thanks!',
  'Bye!',
  'Good job!',
  'Help please',
  'I need help',
  'Yes',
  'No',
  'Maybe',
  'Cool!',
  'Awesome!',
  '👍',
  '😊',
  '🎉',
];

// Words/patterns to block
const BLOCKED_PATTERNS = [
  // Personal information patterns
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{5}(-\d{4})?\b/, // ZIP codes
  // Add profanity patterns
  // Add other concerning patterns
];

export class ChatSafetyService {
  /**
   * Check if message is safe for kids chat
   */
  static async filterMessage(
    message: string,
    filterLevel: 'strict' | 'moderate'
  ): Promise<{
    allowed: boolean;
    filtered: string;
    reason?: string;
  }> {
    // Strict mode: Only predefined phrases
    if (filterLevel === 'strict') {
      if (SAFE_PHRASES.includes(message)) {
        return { allowed: true, filtered: message };
      }
      return { 
        allowed: false, 
        filtered: '', 
        reason: 'Only quick chat phrases allowed' 
      };
    }
    
    // Moderate mode: Block sensitive patterns
    let filtered = message;
    
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(filtered)) {
        return {
          allowed: false,
          filtered: '',
          reason: 'Message contains blocked content',
        };
      }
    }
    
    // Additional AI moderation could be added here
    // const moderationResult = await moderateWithAI(message);
    
    return { allowed: true, filtered };
  }
  
  /**
   * Log chat for moderation review
   */
  static async logForReview(
    senderId: string,
    recipientId: string,
    message: string,
    reason: string
  ): Promise<void> {
    // Log suspicious messages for human review
    console.log('Chat flagged for review:', {
      senderId,
      recipientId,
      message,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### COPPA Compliance Checklist

```markdown
## COPPA Compliance Checklist

### Privacy Policy
- [ ] Clearly describes information collected from children
- [ ] Explains how information is used
- [ ] Describes disclosure practices
- [ ] Explains parental rights (access, delete, stop collection)
- [ ] Provides contact information for privacy inquiries
- [ ] Is prominently linked from homepage and registration

### Parental Notice
- [ ] Sent directly to parent before collecting child's information
- [ ] Clearly identifies the operator
- [ ] Describes what information will be collected
- [ ] Explains how information will be used
- [ ] Provides privacy policy link
- [ ] Explains how to provide/revoke consent

### Parental Consent
- [ ] Obtained BEFORE collecting personal information
- [ ] Uses appropriate verification method
- [ ] Documents consent for audit trail
- [ ] Allows parents to revoke consent
- [ ] Re-obtains consent for material changes

### Data Collection
- [ ] Only collects necessary information
- [ ] No persistent identifiers for behavioral advertising
- [ ] No collection of geolocation without consent
- [ ] No social media integration that exposes child info
- [ ] Profile photos are avatar-based, not uploads

### Data Security
- [ ] Reasonable security measures in place
- [ ] Data encrypted in transit and at rest
- [ ] Access controls limit who can view child data
- [ ] Third-party service providers bound by confidentiality

### Data Retention
- [ ] Only retain data as long as necessary
- [ ] Document retention periods
- [ ] Secure deletion procedures

### Parental Controls
- [ ] Parents can review information collected
- [ ] Parents can delete child's information
- [ ] Parents can stop further collection
- [ ] Parent dashboard provides full control
- [ ] Requests fulfilled within reasonable time

### Age Screening
- [ ] Age gate on registration
- [ ] No incentive to falsify age
- [ ] Under-13 directed to parent flow

### Third Parties
- [ ] All third parties under contract
- [ ] Third parties maintain confidentiality
- [ ] No selling of child data
- [ ] No behavioral advertising targeting children
```

---

## 📋 INDUSTRY SUMMARY

When building for specific industries, always research:

1. **Regulatory Requirements**
   - E-commerce: Consumer protection, tax compliance
   - Education: FERPA, accessibility, accreditation
   - Voice: FCC regulations, call recording laws
   - B2B: Data protection, SOC 2, enterprise security
   - Kids: COPPA, age-appropriate design

2. **Industry Standards**
   - E-commerce: PCI-DSS for payments
   - Education: SCORM/xAPI for content
   - Voice: Opus codec, WebRTC
   - B2B: SAML/OIDC for SSO
   - Kids: Platform-specific guidelines

3. **User Expectations**
   - E-commerce: Fast checkout, easy returns
   - Education: Progress tracking, certificates
   - Voice: Low latency, natural conversation
   - B2B: Enterprise features, SLAs
   - Kids: Safety, parental controls

4. **Common Pitfalls**
   - E-commerce: Cart abandonment, inventory sync
   - Education: Engagement drop-off, cheating
   - Voice: Latency issues, misunderstanding
   - B2B: Complex permissions, data isolation
   - Kids: COPPA violations, inappropriate content

---

*This module provides industry-specific guidance. Always consult with domain experts and legal counsel for your specific implementation.*
