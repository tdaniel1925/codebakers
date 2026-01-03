# CODE GENERATORS
# Module: 10-generators.md
# Load with: 00-core.md
# Covers: Project scaffolding, CRUD generation, admin dashboards, landing pages

---

# PART 23: PROJECT GENERATOR PROTOCOL

## 🏗️ NATURAL LANGUAGE TO FULL PROJECT

When user describes an app in plain English, generate a complete project scaffold.

### Trigger Phrases
- "Build me a..."
- "Create an app for..."
- "I need a SaaS that..."
- "Make a platform for..."
- "Generate a project for..."

### Step 1: Extract Requirements

When user says something like "Build me a SaaS for dog walkers", extract:

```markdown
## Project Analysis

**Core Purpose:** [What does the app do?]
**Target Users:** [Who uses it?]
**Key Features:** [List 5-10 core features]
**Monetization:** [Free, subscription, one-time, freemium?]
**Integrations Needed:** [Payments, email, calendar, etc.]

### Extracted from "Build me a SaaS for dog walkers":

**Core Purpose:** Connect dog owners with dog walkers, manage bookings
**Target Users:** Dog owners (customers), Dog walkers (service providers)
**Key Features:**
1. User registration (two types: owner, walker)
2. Walker profiles with availability
3. Search/filter walkers by location
4. Booking system
5. In-app messaging
6. Payment processing
7. Reviews/ratings
8. Notification system

**Monetization:** Platform fee on each booking (15%)
**Integrations:** Stripe (payments), Resend (email), Twilio (SMS)
```

### Step 2: Generate Database Schema

```typescript
// db/schema.ts - Auto-generated for dog walker platform

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userTypeEnum = pgEnum('user_type', ['owner', 'walker', 'admin']);
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'refunded',
  'failed',
]);

// Users (extends Supabase auth)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  userType: userTypeEnum('user_type').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Walker Profiles (extended info for service providers)
export const walkerProfiles = pgTable('walker_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }).notNull(),
  serviceRadius: integer('service_radius').default(10), // miles
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  isAvailable: boolean('is_available').default(true),
  isVerified: boolean('is_verified').default(false),
  backgroundCheckDate: timestamp('background_check_date'),
  stripeAccountId: text('stripe_account_id'), // For payouts
  services: jsonb('services').default(['walking']), // walking, sitting, boarding
  availability: jsonb('availability').default({}), // Weekly schedule
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('walker_profiles_user_idx').on(table.userId),
  locationIdx: index('walker_profiles_location_idx').on(table.latitude, table.longitude),
  cityIdx: index('walker_profiles_city_idx').on(table.city),
}));

// Dogs (pets belonging to owners)
export const dogs = pgTable('dogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  breed: text('breed'),
  age: integer('age'),
  weight: integer('weight'), // pounds
  size: text('size'), // small, medium, large, xlarge
  temperament: text('temperament'),
  specialNeeds: text('special_needs'),
  photoUrl: text('photo_url'),
  vetInfo: jsonb('vet_info'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('dogs_owner_idx').on(table.ownerId),
}));

// Bookings
export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  walkerId: uuid('walker_id').notNull().references(() => profiles.id),
  dogId: uuid('dog_id').notNull().references(() => dogs.id),
  serviceType: text('service_type').notNull(), // walking, sitting, boarding
  status: bookingStatusEnum('status').default('pending').notNull(),
  scheduledStart: timestamp('scheduled_start').notNull(),
  scheduledEnd: timestamp('scheduled_end').notNull(),
  actualStart: timestamp('actual_start'),
  actualEnd: timestamp('actual_end'),
  duration: integer('duration'), // minutes
  rate: decimal('rate', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal('platform_fee', { precision: 10, scale: 2 }).notNull(),
  walkerPayout: decimal('walker_payout', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  ownerNotes: text('owner_notes'),
  walkerNotes: text('walker_notes'),
  cancellationReason: text('cancellation_reason'),
  cancelledBy: uuid('cancelled_by'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('bookings_owner_idx').on(table.ownerId),
  walkerIdx: index('bookings_walker_idx').on(table.walkerId),
  statusIdx: index('bookings_status_idx').on(table.status),
  scheduledIdx: index('bookings_scheduled_idx').on(table.scheduledStart),
}));

// Payments
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId: text('stripe_transfer_id'), // For walker payout
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal('platform_fee', { precision: 10, scale: 2 }).notNull(),
  walkerPayout: decimal('walker_payout', { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  paidAt: timestamp('paid_at'),
  refundedAt: timestamp('refunded_at'),
  refundReason: text('refund_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  bookingIdx: index('payments_booking_idx').on(table.bookingId),
  stripeIdx: index('payments_stripe_idx').on(table.stripePaymentIntentId),
}));

// Reviews
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  reviewerId: uuid('reviewer_id').notNull().references(() => profiles.id),
  revieweeId: uuid('reviewee_id').notNull().references(() => profiles.id),
  rating: integer('rating').notNull(), // 1-5
  comment: text('comment'),
  response: text('response'), // Reviewee can respond
  respondedAt: timestamp('responded_at'),
  isPublic: boolean('is_public').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  bookingIdx: index('reviews_booking_idx').on(table.bookingId),
  revieweeIdx: index('reviews_reviewee_idx').on(table.revieweeId),
}));

// Messages (in-app chat)
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').references(() => bookings.id),
  participant1Id: uuid('participant1_id').notNull().references(() => profiles.id),
  participant2Id: uuid('participant2_id').notNull().references(() => profiles.id),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  participant1Idx: index('conversations_p1_idx').on(table.participant1Id),
  participant2Idx: index('conversations_p2_idx').on(table.participant2Id),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => profiles.id),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  senderIdx: index('messages_sender_idx').on(table.senderId),
}));

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // booking_request, booking_confirmed, message, review, etc.
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data').default({}),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId),
  unreadIdx: index('notifications_unread_idx').on(table.userId, table.isRead),
}));

// Relations
export const profilesRelations = relations(profiles, ({ one, many }) => ({
  walkerProfile: one(walkerProfiles, {
    fields: [profiles.id],
    references: [walkerProfiles.userId],
  }),
  dogs: many(dogs),
  bookingsAsOwner: many(bookings, { relationName: 'ownerBookings' }),
  bookingsAsWalker: many(bookings, { relationName: 'walkerBookings' }),
  reviewsGiven: many(reviews, { relationName: 'reviewsGiven' }),
  reviewsReceived: many(reviews, { relationName: 'reviewsReceived' }),
  notifications: many(notifications),
}));

// Types
export type Profile = typeof profiles.$inferSelect;
export type WalkerProfile = typeof walkerProfiles.$inferSelect;
export type Dog = typeof dogs.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
```

### Step 3: Generate Project Structure

```
[project-name]/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── dashboard/
│   │   │   │   ├── owner/          # Owner dashboard
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── dogs/
│   │   │   │   │   ├── bookings/
│   │   │   │   │   └── messages/
│   │   │   │   └── walker/         # Walker dashboard
│   │   │   │       ├── page.tsx
│   │   │   │       ├── availability/
│   │   │   │       ├── bookings/
│   │   │   │       ├── earnings/
│   │   │   │       └── messages/
│   │   │   └── settings/
│   │   ├── (public)/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   │   ├── owner/
│   │   │   │   └── walker/
│   │   │   └── walkers/            # Public walker directory
│   │   │       ├── page.tsx        # Search/list
│   │   │       └── [id]/           # Walker profile
│   │   ├── (marketing)/
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── pricing/
│   │   │   ├── how-it-works/
│   │   │   └── become-a-walker/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── walkers/
│   │   │   ├── dogs/
│   │   │   ├── bookings/
│   │   │   ├── payments/
│   │   │   ├── reviews/
│   │   │   ├── messages/
│   │   │   ├── notifications/
│   │   │   └── webhooks/
│   │   │       ├── stripe/
│   │   │       └── twilio/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     # shadcn components
│   │   ├── booking/
│   │   │   ├── booking-form.tsx
│   │   │   ├── booking-card.tsx
│   │   │   ├── booking-list.tsx
│   │   │   └── booking-status.tsx
│   │   ├── walker/
│   │   │   ├── walker-card.tsx
│   │   │   ├── walker-profile.tsx
│   │   │   ├── walker-search.tsx
│   │   │   └── availability-picker.tsx
│   │   ├── dog/
│   │   │   ├── dog-form.tsx
│   │   │   ├── dog-card.tsx
│   │   │   └── dog-selector.tsx
│   │   ├── messaging/
│   │   │   ├── conversation-list.tsx
│   │   │   ├── message-thread.tsx
│   │   │   └── message-input.tsx
│   │   └── reviews/
│   │       ├── review-form.tsx
│   │       ├── review-card.tsx
│   │       └── rating-display.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   ├── stripe/
│   │   ├── twilio/
│   │   └── utils.ts
│   ├── services/
│   │   ├── user-service.ts
│   │   ├── walker-service.ts
│   │   ├── booking-service.ts
│   │   ├── payment-service.ts
│   │   ├── messaging-service.ts
│   │   └── notification-service.ts
│   ├── hooks/
│   │   ├── use-user.ts
│   │   ├── use-walkers.ts
│   │   ├── use-bookings.ts
│   │   ├── use-messages.ts
│   │   └── use-notifications.ts
│   ├── types/
│   └── db/
│       ├── schema.ts
│       └── index.ts
├── tests/
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── booking.spec.ts
│   │   ├── walker-search.spec.ts
│   │   └── messaging.spec.ts
│   └── fixtures/
├── public/
├── .env.example
└── package.json
```

### Step 4: Generate Key Components

After generating schema and structure, generate these in order:
1. Authentication flows (signup for both user types)
2. Walker profile management
3. Walker search/discovery
4. Booking flow
5. Payment processing
6. Messaging
7. Reviews
8. Notifications

### Step 5: Run Tests & Report

```markdown
## 🧪 Project Generation Report: Dog Walker Platform

**Generated:**
- ✅ Database schema (11 tables, 50+ columns)
- ✅ Project structure (40+ files)
- ✅ Authentication (owner + walker signup)
- ✅ Core components (20+ components)
- ✅ API routes (15+ endpoints)
- ✅ Service layer (6 services)
- ✅ Test files (5 E2E test suites)

**Tests Run:**
- Total: 24 tests
- Passed: 24 ✅
- Failed: 0 ❌

**Next Steps:**
1. Set up Stripe Connect for walker payouts
2. Configure Twilio for SMS notifications
3. Add Google Maps for location search
4. Deploy to Vercel

**Ready to continue building?**
```

---

# PART 24: SCHEMA GENERATOR

## 📊 ENGLISH TO DATABASE SCHEMA

When user describes data in plain English, generate complete database schema.

### Trigger Phrases
- "I need to track..."
- "Create tables for..."
- "Database for..."
- "Schema for..."

### Step 1: Parse Requirements

**User:** "I need to track customers, their orders, order items, and inventory"

**Extract:**
```markdown
## Entities Identified:
1. Customers - people who buy things
2. Orders - purchases made by customers
3. Order Items - individual products in an order
4. Inventory/Products - things being sold

## Relationships:
- Customer has many Orders (1:N)
- Order has many Order Items (1:N)
- Order Item belongs to Product (N:1)
- Product has inventory count

## Implicit Requirements:
- Timestamps on all tables
- Soft delete for customers/orders
- Order status tracking
- Inventory tracking with low stock alerts
```

### Step 2: Generate Schema

```typescript
// db/schema.ts - Generated from "customers, orders, order items, inventory"

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

// Customers
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  
  // Billing address
  billingAddress: text('billing_address'),
  billingCity: text('billing_city'),
  billingState: text('billing_state'),
  billingZip: text('billing_zip'),
  billingCountry: text('billing_country').default('US'),
  
  // Shipping address
  shippingAddress: text('shipping_address'),
  shippingCity: text('shipping_city'),
  shippingState: text('shipping_state'),
  shippingZip: text('shipping_zip'),
  shippingCountry: text('shipping_country').default('US'),
  
  // Stripe
  stripeCustomerId: text('stripe_customer_id'),
  
  // Metadata
  notes: text('notes'),
  tags: text('tags').array(),
  isActive: boolean('is_active').default(true).notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('customers_email_idx').on(table.email),
  stripeIdx: index('customers_stripe_idx').on(table.stripeCustomerId),
}));

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal('compare_at_price', { precision: 10, scale: 2 }),
  cost: decimal('cost', { precision: 10, scale: 2 }), // For profit tracking
  
  // Inventory
  inventoryCount: integer('inventory_count').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10),
  trackInventory: boolean('track_inventory').default(true),
  allowBackorder: boolean('allow_backorder').default(false),
  
  // Categorization
  category: text('category'),
  subcategory: text('subcategory'),
  tags: text('tags').array(),
  
  // Media
  imageUrl: text('image_url'),
  images: text('images').array(),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isFeatured: boolean('is_featured').default(false),
  
  // SEO
  slug: text('slug').notNull(),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  skuIdx: uniqueIndex('products_sku_idx').on(table.sku),
  slugIdx: uniqueIndex('products_slug_idx').on(table.slug),
  categoryIdx: index('products_category_idx').on(table.category),
}));

// Orders
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  // Status
  status: orderStatusEnum('status').default('pending').notNull(),
  
  // Amounts
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  shippingAmount: decimal('shipping_amount', { precision: 10, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  
  // Shipping
  shippingAddress: text('shipping_address'),
  shippingCity: text('shipping_city'),
  shippingState: text('shipping_state'),
  shippingZip: text('shipping_zip'),
  shippingCountry: text('shipping_country'),
  shippingMethod: text('shipping_method'),
  trackingNumber: text('tracking_number'),
  
  // Payment
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paidAt: timestamp('paid_at'),
  
  // Fulfillment
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  
  // Notes
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  
  // Cancellation
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orderNumberIdx: uniqueIndex('orders_order_number_idx').on(table.orderNumber),
  customerIdx: index('orders_customer_idx').on(table.customerId),
  statusIdx: index('orders_status_idx').on(table.status),
  createdIdx: index('orders_created_idx').on(table.createdAt),
}));

// Order Items
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  
  // Snapshot of product at time of order
  productName: text('product_name').notNull(),
  productSku: text('product_sku').notNull(),
  
  // Pricing
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  
  // Fulfillment
  fulfilledQuantity: integer('fulfilled_quantity').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orderIdx: index('order_items_order_idx').on(table.orderId),
  productIdx: index('order_items_product_idx').on(table.productId),
}));

// Inventory Transactions (for tracking changes)
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id),
  type: text('type').notNull(), // 'adjustment', 'sale', 'restock', 'return'
  quantity: integer('quantity').notNull(), // Positive for additions, negative for removals
  previousCount: integer('previous_count').notNull(),
  newCount: integer('new_count').notNull(),
  reason: text('reason'),
  orderId: uuid('order_id').references(() => orders.id),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  productIdx: index('inventory_tx_product_idx').on(table.productId),
  typeIdx: index('inventory_tx_type_idx').on(table.type),
}));

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
  inventoryTransactions: many(inventoryTransactions),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

// Types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
```

### Step 3: Generate Migrations

```sql
-- Generated migration: 0001_create_ecommerce_schema.sql

-- Enums
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'US',
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'US',
  stripe_customer_id TEXT,
  notes TEXT,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_email_idx ON customers(email);
CREATE INDEX customers_stripe_idx ON customers(stripe_customer_id);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  cost DECIMAL(10, 2),
  inventory_count INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false,
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  image_url TEXT,
  images TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  slug TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX products_sku_idx ON products(sku);
CREATE UNIQUE INDEX products_slug_idx ON products(slug);
CREATE INDEX products_category_idx ON products(category);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  status order_status NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT,
  shipping_method TEXT,
  tracking_number TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  customer_notes TEXT,
  internal_notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX orders_order_number_idx ON orders(order_number);
CREATE INDEX orders_customer_idx ON orders(customer_id);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_created_idx ON orders(created_at);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  fulfilled_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_product_idx ON order_items(product_id);

-- Inventory Transactions
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  previous_count INTEGER NOT NULL,
  new_count INTEGER NOT NULL,
  reason TEXT,
  order_id UUID REFERENCES orders(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inventory_tx_product_idx ON inventory_transactions(product_id);
CREATE INDEX inventory_tx_type_idx ON inventory_transactions(type);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Step 4: Report

```markdown
## 📊 Schema Generation Report

**Input:** "I need to track customers, their orders, order items, and inventory"

**Generated:**
- ✅ 5 tables (customers, products, orders, order_items, inventory_transactions)
- ✅ 80+ columns with proper types
- ✅ 12 indexes for performance
- ✅ Foreign key relationships
- ✅ RLS enabled on all tables
- ✅ Updated_at triggers
- ✅ TypeScript types exported
- ✅ Drizzle relations configured

**Additional Features Added:**
- Soft delete for customers and products
- Order status enum with full lifecycle
- Inventory tracking with transactions
- Stripe integration fields
- SEO fields for products
- Shipping/billing address separation

**Run migration with:**
```bash
npm run db:migrate
```
```

---

# PART 25: AUTO-CRUD GENERATOR

## 🔄 SCHEMA TO FULL API + UI

When schema exists, automatically generate all CRUD operations.

### Trigger Phrases
- "Generate CRUD for..."
- "Create API for [table]..."
- "Build UI for [table]..."
- "Full CRUD for..."

### For Each Table, Generate:

#### 1. Service Layer

```typescript
// services/[resource]-service.ts
// Auto-generated CRUD service for [Resource]

import { db } from '@/db';
import { [resources], New[Resource], [Resource] } from '@/db/schema';
import { eq, desc, asc, like, and, or, sql } from 'drizzle-orm';

interface List[Resources]Params {
  page?: number;
  limit?: number;
  sortBy?: keyof [Resource];
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Partial<[Resource]>;
}

interface List[Resources]Result {
  data: [Resource][];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class [Resource]Service {
  /**
   * List [resources] with pagination, sorting, and filtering
   */
  static async list(params: List[Resources]Params = {}): Promise<List[Resources]Result> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      filters,
    } = params;

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          conditions.push(eq([resources][key as keyof typeof [resources]], value));
        }
      });
    }

    if (search) {
      conditions.push(
        or(
          like([resources].name, `%${search}%`),
          // Add other searchable fields
        )
      );
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from([resources])
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get paginated data
    const data = await db
      .select()
      .from([resources])
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sortOrder === 'desc' 
          ? desc([resources][sortBy]) 
          : asc([resources][sortBy])
      )
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Get single [resource] by ID
   */
  static async getById(id: string): Promise<[Resource] | null> {
    const [result] = await db
      .select()
      .from([resources])
      .where(eq([resources].id, id))
      .limit(1);
    
    return result ?? null;
  }

  /**
   * Create [resource]
   */
  static async create(data: New[Resource]): Promise<[Resource]> {
    const [result] = await db
      .insert([resources])
      .values(data)
      .returning();
    
    return result;
  }

  /**
   * Update [resource]
   */
  static async update(id: string, data: Partial<New[Resource]>): Promise<[Resource] | null> {
    const [result] = await db
      .update([resources])
      .set({ ...data, updatedAt: new Date() })
      .where(eq([resources].id, id))
      .returning();
    
    return result ?? null;
  }

  /**
   * Delete [resource]
   */
  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete([resources])
      .where(eq([resources].id, id));
    
    return result.rowCount > 0;
  }

  /**
   * Soft delete [resource]
   */
  static async softDelete(id: string): Promise<[Resource] | null> {
    const [result] = await db
      .update([resources])
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq([resources].id, id))
      .returning();
    
    return result ?? null;
  }

  /**
   * Restore soft-deleted [resource]
   */
  static async restore(id: string): Promise<[Resource] | null> {
    const [result] = await db
      .update([resources])
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq([resources].id, id))
      .returning();
    
    return result ?? null;
  }

  /**
   * Bulk delete
   */
  static async bulkDelete(ids: string[]): Promise<number> {
    const result = await db
      .delete([resources])
      .where(sql`${[resources].id} = ANY(${ids})`);
    
    return result.rowCount;
  }
}
```

#### 2. API Routes

```typescript
// app/api/[resources]/route.ts
// Auto-generated API routes for [Resource]

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { [Resource]Service } from '@/services/[resource]-service';

// Validation schemas
const create[Resource]Schema = z.object({
  // Auto-generated from schema columns
  name: z.string().min(1).max(255),
  // ... other fields
});

const update[Resource]Schema = create[Resource]Schema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

// GET - List [resources]
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = listQuerySchema.parse(Object.fromEntries(searchParams));

    const result = await [Resource]Service.list(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/[resources] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST - Create [resource]
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = create[Resource]Schema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const [resource] = await [Resource]Service.create(result.data);

    return NextResponse.json({ data: [resource] }, { status: 201 });
  } catch (error) {
    console.error('POST /api/[resources] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE - Bulk delete
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { ids } = await req.json();
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid ids array', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const deletedCount = await [Resource]Service.bulkDelete(ids);

    return NextResponse.json({ deleted: deletedCount });
  } catch (error) {
    console.error('DELETE /api/[resources] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/[resources]/[id]/route.ts
// Auto-generated single resource routes

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { [Resource]Service } from '@/services/[resource]-service';

type RouteParams = { params: { id: string } };

// GET - Get single [resource]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const [resource] = await [Resource]Service.getById(params.id);

    if (![resource]) {
      return NextResponse.json(
        { error: '[Resource] not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: [resource] });
  } catch (error) {
    console.error(`GET /api/[resources]/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// PATCH - Update [resource]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = update[Resource]Schema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const [resource] = await [Resource]Service.update(params.id, result.data);

    if (![resource]) {
      return NextResponse.json(
        { error: '[Resource] not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: [resource] });
  } catch (error) {
    console.error(`PATCH /api/[resources]/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE - Delete single [resource]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const deleted = await [Resource]Service.delete(params.id);

    if (!deleted) {
      return NextResponse.json(
        { error: '[Resource] not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/[resources]/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

#### 3. React Hooks

```typescript
// hooks/use-[resources].ts
// Auto-generated hooks for [Resource]

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface [Resource] {
  id: string;
  // ... fields from schema
}

interface List[Resources]Params {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface List[Resources]Result {
  data: [Resource][];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// List hook with pagination
export function use[Resources](params: List[Resources]Params = {}) {
  return useQuery({
    queryKey: ['[resources]', params],
    queryFn: async (): Promise<List[Resources]Result> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });

      const response = await fetch(`/api/[resources]?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch [resources]');
      return response.json();
    },
  });
}

// Single resource hook
export function use[Resource](id: string) {
  return useQuery({
    queryKey: ['[resources]', id],
    queryFn: async (): Promise<[Resource]> => {
      const response = await fetch(`/api/[resources]/${id}`);
      if (!response.ok) throw new Error('[Resource] not found');
      const { data } = await response.json();
      return data;
    },
    enabled: !!id,
  });
}

// Create hook
export function useCreate[Resource]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<[Resource]>) => {
      const response = await fetch('/api/[resources]', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create [resource]');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[resources]'] });
      toast.success('[Resource] created successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Update hook
export function useUpdate[Resource]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<[Resource]> }) => {
      const response = await fetch(`/api/[resources]/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update [resource]');
      }
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['[resources]'] });
      queryClient.invalidateQueries({ queryKey: ['[resources]', id] });
      toast.success('[Resource] updated successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Delete hook
export function useDelete[Resource]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/[resources]/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete [resource]');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[resources]'] });
      toast.success('[Resource] deleted successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Bulk delete hook
export function useBulkDelete[Resources]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch('/api/[resources]', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete [resources]');
      }
      return response.json();
    },
    onSuccess: ({ deleted }) => {
      queryClient.invalidateQueries({ queryKey: ['[resources]'] });
      toast.success(`${deleted} [resources] deleted`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

#### 4. UI Components

```typescript
// components/[resources]/[resource]-list.tsx
// Auto-generated list component

'use client';

import { useState } from 'react';
import { use[Resources], useDelete[Resource], useBulkDelete[Resources] } from '@/hooks/use-[resources]';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Loader2, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface [Resource]ListProps {
  onEdit?: (id: string) => void;
  onCreate?: () => void;
}

export function [Resource]List({ onEdit, onCreate }: [Resource]ListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, error } = use[Resources]({ page, search, limit: 20 });
  const deleteOne = useDelete[Resource]();
  const deleteMany = useBulkDelete[Resources]();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (data?.data) {
      if (selectedIds.length === data.data.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(data.data.map((item) => item.id));
      }
    }
  };

  const handleBulkDelete = async () => {
    await deleteMany.mutateAsync(selectedIds);
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-12 text-destructive">
        Failed to load [resources]
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[250px]"
            />
          </div>
          {selectedIds.length > 0 && (
            <ConfirmDialog
              title="Delete selected?"
              description={`This will delete ${selectedIds.length} [resources].`}
              onConfirm={handleBulkDelete}
            >
              <Button variant="destructive" size="sm">
                Delete ({selectedIds.length})
              </Button>
            </ConfirmDialog>
          )}
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add [Resource]
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    data?.data?.length > 0 &&
                    selectedIds.length === data.data.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              {/* Add more columns based on schema */}
              <TableHead>Created</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  No [resources] found
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(item.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <ConfirmDialog
                          title="Delete [resource]?"
                          description="This action cannot be undone."
                          onConfirm={() => deleteOne.mutateAsync(item.id)}
                        >
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </ConfirmDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```


---

# PART 26: SELF-HEALING PROTOCOL

## 🔧 AUTO-FIX ERRORS WITHOUT ASKING

When an error occurs during development or testing, automatically diagnose and fix it.

### Trigger Conditions
- Build fails
- Test fails
- Runtime error occurs
- TypeScript error
- Lint error

### Self-Healing Process

```markdown
## 🔧 SELF-HEALING PROTOCOL

When an error occurs:

### Step 1: Capture Error Context
- Full error message
- Stack trace
- File and line number
- Recent changes made

### Step 2: Diagnose
Match error against known patterns:

**TypeScript Errors:**
- "Property X does not exist" → Add missing property or fix typo
- "Type X is not assignable to type Y" → Fix type mismatch
- "Cannot find module" → Install missing package or fix import path
- "Object is possibly undefined" → Add null check or optional chaining

**Build Errors:**
- "Module not found" → Check import paths, install missing deps
- "Unexpected token" → Syntax error, check for typos
- "ENOENT" → File doesn't exist, create it or fix path

**Runtime Errors:**
- "Cannot read property of undefined" → Add null checks
- "X is not a function" → Check import, function exists
- "Network error" → Add error handling, check API
- "CORS error" → Configure CORS headers

**Test Errors:**
- "Element not found" → Check selector, add wait
- "Timeout" → Increase timeout, check async handling
- "Expected X but received Y" → Fix assertion or code

### Step 3: Apply Fix Automatically
1. Make the minimal change to fix the error
2. Do not ask for permission
3. Do not explain before fixing
4. Just fix it

### Step 4: Verify Fix
1. Re-run the failed command
2. If still failing, try alternative fix
3. After 3 attempts, report to user

### Step 5: Report (Only After Fixed)
```
✅ Auto-fixed: [Error Type]
- File: [path]
- Issue: [brief description]
- Fix: [what was changed]
```
```

### Common Auto-Fix Patterns

```typescript
// Pattern: Missing Import
// Error: "Cannot find name 'useState'"
// Auto-fix:
import { useState } from 'react';  // ← Add this

// Pattern: Missing Null Check
// Error: "Cannot read property 'name' of undefined"
// Before:
const name = user.name;
// Auto-fix:
const name = user?.name;

// Pattern: Missing Async/Await
// Error: "Promise { <pending> }" in output
// Before:
const data = fetchData();
// Auto-fix:
const data = await fetchData();

// Pattern: Wrong Import Path
// Error: "Module not found: @/components/Button"
// Before:
import { Button } from '@/components/Button';
// Auto-fix:
import { Button } from '@/components/ui/button';

// Pattern: Missing Return Type
// Error: "Function lacks return type"
// Before:
function getData() {
// Auto-fix:
function getData(): Promise<Data> {

// Pattern: Missing Key Prop
// Error: "Each child should have a unique key prop"
// Before:
{items.map(item => <Item item={item} />)}
// Auto-fix:
{items.map(item => <Item key={item.id} item={item} />)}

// Pattern: Unused Variable
// Error: "'data' is declared but never used"
// Before:
const data = fetchData();
// Auto-fix:
const _data = fetchData(); // or remove if truly unused

// Pattern: Missing Error Handling
// Error: "Unhandled promise rejection"
// Before:
await riskyOperation();
// Auto-fix:
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  throw error;
}
```

### Self-Healing for Test Failures

```typescript
// Pattern: Element Not Found
// Error: "Unable to find element with text 'Submit'"
// Diagnosis: Button text might be different or element not rendered

// Fix attempts in order:
// 1. Check for loading state
await page.waitForLoadState('networkidle');

// 2. Try alternative selectors
await page.getByRole('button', { name: /submit/i }).click();

// 3. Wait for element
await page.waitForSelector('button[type="submit"]');

// 4. Check if element is in viewport
await page.getByText('Submit').scrollIntoViewIfNeeded();


// Pattern: Timeout
// Error: "Test timeout of 30000ms exceeded"
// Diagnosis: Async operation taking too long

// Fix attempts:
// 1. Increase specific timeout
await expect(page.getByText('Done')).toBeVisible({ timeout: 60000 });

// 2. Wait for network
await page.waitForLoadState('networkidle');

// 3. Wait for specific response
await page.waitForResponse(resp => resp.url().includes('/api/data'));


// Pattern: Assertion Mismatch
// Error: "Expected 'active' but received 'pending'"
// Diagnosis: State not updated or race condition

// Fix attempts:
// 1. Add explicit wait
await page.waitForFunction(() => {
  return document.querySelector('[data-status]')?.textContent === 'active';
});

// 2. Poll for state change
await expect(async () => {
  const status = await page.getByTestId('status').textContent();
  expect(status).toBe('active');
}).toPass({ timeout: 10000 });
```

### When NOT to Self-Heal

```markdown
DO NOT auto-fix:
- Logic errors (wrong business logic)
- Security vulnerabilities (needs human review)
- Data corruption issues
- Performance problems
- Architectural decisions
- Breaking API changes

Instead, report these clearly:

```
⚠️ Cannot auto-fix: [Issue Type]

This requires human decision:
- [Explain the issue]
- [Show options]
- [Ask which approach to take]
```
```

---

# PART 27: LANDING PAGE GENERATOR

## 🎨 NATURAL LANGUAGE TO MARKETING PAGE

Generate complete, conversion-optimized landing pages from descriptions.

### Trigger Phrases
- "Create a landing page for..."
- "Make a marketing page..."
- "Build a homepage for..."
- "Landing page for [product]..."

### Step 1: Extract Marketing Requirements

**User:** "Create a landing page for my AI writing assistant SaaS"

**Extract:**
```markdown
## Landing Page Analysis

**Product:** AI Writing Assistant
**Type:** SaaS (subscription-based)
**Target Audience:** Content creators, marketers, writers

**Key Sections Needed:**
1. Hero (headline, subheadline, CTA)
2. Problem/Solution
3. Features/Benefits
4. How It Works
5. Pricing
6. Social Proof (testimonials)
7. FAQ
8. Final CTA

**Tone:** Professional but friendly, confident
**Primary CTA:** Start free trial
**Secondary CTA:** See demo
```

### Step 2: Generate Landing Page

```typescript
// app/(marketing)/page.tsx
// Auto-generated landing page

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Check, 
  Star, 
  Zap, 
  Shield, 
  Clock, 
  ArrowRight,
  Sparkles,
  FileText,
  BarChart,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6" />
            <span className="font-bold text-xl">WriteAI</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="#features" className="hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="#testimonials" className="hover:text-primary transition-colors">
              Testimonials
            </Link>
            <Link href="#faq" className="hover:text-primary transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32">
          <div className="container">
            <div className="flex flex-col items-center text-center space-y-8">
              <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm">
                <span className="mr-2">🎉</span>
                <span>Now with GPT-4 Turbo</span>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl">
                Write 10x faster with{' '}
                <span className="text-primary">AI-powered</span> assistance
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl">
                The AI writing assistant that helps you create compelling content 
                in minutes, not hours. Blog posts, emails, ads, and more.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="text-lg px-8">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#demo">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Watch Demo
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                No credit card required · 14-day free trial · Cancel anytime
              </p>
            </div>
          </div>
        </section>

        {/* Logos Section */}
        <section className="py-12 border-y bg-muted/50">
          <div className="container">
            <p className="text-center text-sm text-muted-foreground mb-8">
              Trusted by 10,000+ content creators at
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50">
              {/* Add company logos here */}
              <div className="text-2xl font-bold">Company 1</div>
              <div className="text-2xl font-bold">Company 2</div>
              <div className="text-2xl font-bold">Company 3</div>
              <div className="text-2xl font-bold">Company 4</div>
              <div className="text-2xl font-bold">Company 5</div>
            </div>
          </div>
        </section>

        {/* Problem/Solution */}
        <section className="py-20">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Stop staring at blank pages
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Writer's block is real. You know what you want to say, but 
                  getting the words out takes forever. Deadlines pile up. 
                  Quality suffers.
                </p>
                <p className="text-lg text-muted-foreground">
                  WriteAI understands your intent and generates high-quality 
                  drafts instantly. Edit, refine, and publish in a fraction 
                  of the time.
                </p>
              </div>
              <div className="bg-muted rounded-lg p-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-destructive/10 p-2">
                      <Clock className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium">Without WriteAI</p>
                      <p className="text-muted-foreground">
                        4+ hours to write a blog post
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">With WriteAI</p>
                      <p className="text-muted-foreground">
                        First draft in 5 minutes
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything you need to write better
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful AI features designed for professional content creators
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="bg-background rounded-lg p-6 shadow-sm border"
                >
                  <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How it works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get from idea to published content in 3 simple steps
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl mb-4">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Start free, upgrade when you need more
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {pricingPlans.map((plan, index) => (
                <div
                  key={index}
                  className={`bg-background rounded-lg p-8 border-2 ${
                    plan.popular ? 'border-primary shadow-lg scale-105' : 'border-border'
                  }`}
                >
                  {plan.popular && (
                    <div className="text-center mb-4">
                      <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-muted-foreground mb-6">{plan.description}</p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-20">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Loved by content creators
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                See what our users have to say
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <div 
                  key={index}
                  className="bg-muted/50 rounded-lg p-6"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="mb-4 text-muted-foreground">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10" />
                    <div>
                      <p className="font-medium">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently asked questions
              </h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="bg-background rounded-lg p-6 border"
                >
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="container">
            <div className="bg-primary rounded-2xl p-12 md:p-20 text-center text-primary-foreground">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to write 10x faster?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Join 10,000+ content creators using WriteAI
              </p>
              <Link href="/signup">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features">Features</Link></li>
                <li><Link href="#pricing">Pricing</Link></li>
                <li><Link href="/changelog">Changelog</Link></li>
                <li><Link href="/roadmap">Roadmap</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about">About</Link></li>
                <li><Link href="/blog">Blog</Link></li>
                <li><Link href="/careers">Careers</Link></li>
                <li><Link href="/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/docs">Documentation</Link></li>
                <li><Link href="/help">Help Center</Link></li>
                <li><Link href="/guides">Guides</Link></li>
                <li><Link href="/api">API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms</Link></li>
                <li><Link href="/security">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 WriteAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Data
const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Writing',
    description: 'Generate high-quality content with state-of-the-art AI models.',
  },
  {
    icon: FileText,
    title: '50+ Templates',
    description: 'Blog posts, emails, ads, social media, and more ready to use.',
  },
  {
    icon: BarChart,
    title: 'SEO Optimization',
    description: 'Built-in SEO suggestions to rank higher in search results.',
  },
  {
    icon: Zap,
    title: 'Instant Generation',
    description: 'Get your first draft in seconds, not hours.',
  },
  {
    icon: Shield,
    title: 'Plagiarism-Free',
    description: '100% original content that passes plagiarism checkers.',
  },
  {
    icon: Clock,
    title: 'Version History',
    description: 'Never lose your work with automatic version saving.',
  },
];

const steps = [
  {
    title: 'Describe your content',
    description: 'Tell us what you want to write about and who it\'s for.',
  },
  {
    title: 'AI generates draft',
    description: 'Our AI creates a high-quality first draft in seconds.',
  },
  {
    title: 'Edit and publish',
    description: 'Refine the content and publish directly to your platform.',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 0,
    description: 'Perfect for trying out WriteAI',
    features: [
      '10,000 words/month',
      '10+ templates',
      'Basic editor',
      'Email support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: 29,
    description: 'For professional content creators',
    features: [
      'Unlimited words',
      '50+ templates',
      'Advanced editor',
      'SEO optimization',
      'Priority support',
      'API access',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Team',
    price: 99,
    description: 'For teams and agencies',
    features: [
      'Everything in Pro',
      '5 team members',
      'Brand voice training',
      'Collaboration tools',
      'Admin dashboard',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const testimonials = [
  {
    quote: 'WriteAI has completely transformed how I create content. What used to take me 4 hours now takes 30 minutes.',
    name: 'Sarah Johnson',
    title: 'Content Marketing Manager',
  },
  {
    quote: 'The quality of the AI-generated content is incredible. My blog traffic has increased 300% since I started using WriteAI.',
    name: 'Michael Chen',
    title: 'Freelance Writer',
  },
  {
    quote: 'As a non-native English speaker, WriteAI helps me write professional content that resonates with my audience.',
    name: 'Elena Rodriguez',
    title: 'Startup Founder',
  },
];

const faqs = [
  {
    question: 'Is the content plagiarism-free?',
    answer: 'Yes, all content generated by WriteAI is 100% original and will pass plagiarism checkers.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time. No questions asked.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'Yes, we offer a 30-day money-back guarantee if you\'re not satisfied.',
  },
  {
    question: 'What AI model do you use?',
    answer: 'We use a combination of GPT-4 Turbo and our proprietary fine-tuned models for the best results.',
  },
];
```

---

# PART 28: ADMIN DASHBOARD GENERATOR

## 📊 AUTOMATIC ADMIN PANEL FROM SCHEMA

Generate complete admin dashboards with CRUD operations for all database tables.

### Trigger Phrases
- "Add admin panel"
- "Create admin dashboard"
- "Build admin interface"
- "Generate admin UI"

### Generated Admin Structure

```
app/
└── (auth)/
    └── admin/
        ├── layout.tsx          # Admin layout with sidebar
        ├── page.tsx            # Dashboard overview
        ├── users/
        │   ├── page.tsx        # User list
        │   └── [id]/
        │       └── page.tsx    # User detail/edit
        ├── [resource]/         # For each DB table
        │   ├── page.tsx
        │   └── [id]/
        │       └── page.tsx
        └── settings/
            └── page.tsx
```

### Admin Layout

```typescript
// app/(auth)/admin/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  Settings,
  BarChart,
  FileText,
  Bell,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const sidebarItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart },
  { name: 'Content', href: '/admin/content', icon: FileText },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-6 border-b">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">A</span>
            </div>
            <span className="font-bold text-lg">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start" asChild>
            <Link href="/api/auth/logout">
              <LogOut className="mr-2 h-5 w-5" />
              Log out
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

### Admin Dashboard Overview

```typescript
// app/(auth)/admin/page.tsx
import { Suspense } from 'react';
import { 
  Users, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db';
import { users, orders, payments } from '@/db/schema';
import { sql, gte, and } from 'drizzle-orm';

async function getStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // Current period stats
  const [currentUsers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(gte(users.createdAt, thirtyDaysAgo));

  const [currentOrders] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(gte(orders.createdAt, thirtyDaysAgo));

  const [currentRevenue] = await db
    .select({ sum: sql<number>`COALESCE(SUM(total_amount), 0)` })
    .from(payments)
    .where(and(
      gte(payments.createdAt, thirtyDaysAgo),
      sql`${payments.status} = 'paid'`
    ));

  // Previous period stats (for comparison)
  const [previousUsers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(
      gte(users.createdAt, sixtyDaysAgo),
      sql`${users.createdAt} < ${thirtyDaysAgo}`
    ));

  const [previousRevenue] = await db
    .select({ sum: sql<number>`COALESCE(SUM(total_amount), 0)` })
    .from(payments)
    .where(and(
      gte(payments.createdAt, sixtyDaysAgo),
      sql`${payments.createdAt} < ${thirtyDaysAgo}`,
      sql`${payments.status} = 'paid'`
    ));

  return {
    users: {
      current: currentUsers.count,
      previous: previousUsers.count,
    },
    orders: {
      current: currentOrders.count,
    },
    revenue: {
      current: currentRevenue.sum,
      previous: previousRevenue.sum,
    },
  };
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
}: {
  title: string;
  value: number;
  change?: number;
  icon: any;
  format?: 'number' | 'currency' | 'percent';
}) {
  const formattedValue = format === 'currency'
    ? `$${value.toLocaleString()}`
    : format === 'percent'
    ? `${value}%`
    : value.toLocaleString();

  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{formattedValue}</div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center text-sm mt-1',
            isPositive && 'text-green-600',
            isNegative && 'text-red-600',
            !isPositive && !isNegative && 'text-muted-foreground'
          )}>
            {isPositive && <ArrowUpRight className="h-4 w-4 mr-1" />}
            {isNegative && <ArrowDownRight className="h-4 w-4 mr-1" />}
            {Math.abs(change)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const userChange = stats.users.previous > 0
    ? Math.round(((stats.users.current - stats.users.previous) / stats.users.previous) * 100)
    : 0;

  const revenueChange = stats.revenue.previous > 0
    ? Math.round(((stats.revenue.current - stats.revenue.previous) / stats.revenue.previous) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your platform's performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="New Users"
          value={stats.users.current}
          change={userChange}
          icon={Users}
        />
        <StatCard
          title="Orders"
          value={stats.orders.current}
          icon={ShoppingCart}
        />
        <StatCard
          title="Revenue"
          value={stats.revenue.current}
          change={revenueChange}
          icon={DollarSign}
          format="currency"
        />
        <StatCard
          title="Growth"
          value={revenueChange}
          icon={TrendingUp}
          format="percent"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading...</div>}>
              <RecentOrders />
            </Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading...</div>}>
              <RecentUsers />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function RecentOrders() {
  const recentOrders = await db
    .select()
    .from(orders)
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(5);

  return (
    <div className="space-y-4">
      {recentOrders.map((order) => (
        <div key={order.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{order.orderNumber}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">${Number(order.totalAmount).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground capitalize">{order.status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

async function RecentUsers() {
  const recentUsers = await db
    .select()
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(5);

  return (
    <div className="space-y-4">
      {recentUsers.map((user) => (
        <div key={user.id} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="font-medium">
              {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{user.name || 'No name'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

