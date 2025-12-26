# DATABASE PATTERNS
# Module: 01-database.md
# Load with: 00-core.md

---

# PART 5: DATABASE PATTERNS

## 🗄️ DRIZZLE ORM WITH SUPABASE

### Database Connection

```typescript
// db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Connection pool for server-side
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

// Types
export type DbClient = typeof db;
```

### Schema Definition

```typescript
// db/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'member', 'viewer']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'canceled',
  'past_due',
  'trialing',
]);

// Users table (extends Supabase auth.users)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // References auth.users.id
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('profiles_email_idx').on(table.email),
}));

// Organizations (for multi-tenant)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logoUrl: text('logo_url'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
}));

// Organization members
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgUserIdx: uniqueIndex('org_members_org_user_idx')
    .on(table.organizationId, table.userId),
  orgIdx: index('org_members_org_idx').on(table.organizationId),
  userIdx: index('org_members_user_idx').on(table.userId),
}));

// Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  status: subscriptionStatusEnum('status').default('trialing').notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: uniqueIndex('subscriptions_org_idx').on(table.organizationId),
  stripeCustomerIdx: index('subscriptions_stripe_customer_idx')
    .on(table.stripeCustomerId),
}));

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  organizationMembers: many(organizationMembers),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  subscription: one(subscriptions, {
    fields: [organizations.id],
    references: [subscriptions.organizationId],
  }),
}));

export const organizationMembersRelations = relations(
  organizationMembers, 
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(profiles, {
      fields: [organizationMembers.userId],
      references: [profiles.id],
    }),
  })
);

// Export types
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
```

### Database Service Layer

```typescript
// services/user-service.ts
import { db } from '@/db';
import { profiles, organizationMembers, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { Profile, NewProfile } from '@/db/schema';

export class UserService {
  /**
   * Get user profile by ID
   */
  static async getById(id: string): Promise<Profile | null> {
    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    
    return user ?? null;
  }

  /**
   * Get user profile by email
   */
  static async getByEmail(email: string): Promise<Profile | null> {
    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);
    
    return user ?? null;
  }

  /**
   * Create user profile
   */
  static async create(data: NewProfile): Promise<Profile> {
    const [user] = await db
      .insert(profiles)
      .values(data)
      .returning();
    
    return user;
  }

  /**
   * Update user profile
   */
  static async update(
    id: string, 
    data: Partial<NewProfile>
  ): Promise<Profile | null> {
    const [user] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    
    return user ?? null;
  }

  /**
   * Delete user profile
   */
  static async delete(id: string): Promise<void> {
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  /**
   * Get user's organizations
   */
  static async getOrganizations(userId: string) {
    return db
      .select({
        organization: organizations,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id)
      )
      .where(eq(organizationMembers.userId, userId));
  }

  /**
   * Check if user has access to organization
   */
  static async hasOrgAccess(
    userId: string, 
    organizationId: string
  ): Promise<boolean> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return !!member;
  }

  /**
   * Check if user has specific role in organization
   */
  static async hasOrgRole(
    userId: string,
    organizationId: string,
    roles: string[]
  ): Promise<boolean> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return !!member && roles.includes(member.role);
  }
}
```

### Transaction Example

```typescript
// services/organization-service.ts
import { db } from '@/db';
import { organizations, organizationMembers, subscriptions } from '@/db/schema';

export class OrganizationService {
  /**
   * Create organization with owner
   * Uses transaction to ensure atomicity
   */
  static async createWithOwner(
    name: string,
    slug: string,
    ownerId: string
  ) {
    return db.transaction(async (tx) => {
      // Create organization
      const [org] = await tx
        .insert(organizations)
        .values({ name, slug })
        .returning();

      // Add owner as admin
      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: ownerId,
        role: 'admin',
      });

      // Create trial subscription
      await tx.insert(subscriptions).values({
        organizationId: org.id,
        status: 'trialing',
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });

      return org;
    });
  }
}
```

### Drizzle Config

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

---


---

# PART 49: AUDIT LOGGING

## Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
  entity_type TEXT NOT NULL, -- 'project', 'user', 'team', etc.
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX audit_logs_team_idx ON audit_logs(team_id);
CREATE INDEX audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at);
```

## Audit Service

```typescript
// services/audit-service.ts
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { headers } from 'next/headers';

interface AuditLogData {
  teamId?: string;
  userId?: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'invite' | 'remove';
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export class AuditService {
  static async log(data: AuditLogData) {
    const headersList = headers();
    
    await db.insert(auditLogs).values({
      ...data,
      ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip'),
      userAgent: headersList.get('user-agent'),
    });
  }
  
  static async getForTeam(teamId: string, options: {
    limit?: number;
    offset?: number;
    entityType?: string;
    userId?: string;
  } = {}) {
    const { limit = 50, offset = 0, entityType, userId } = options;
    
    let conditions = [eq(auditLogs.teamId, teamId)];
    
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    
    return db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

// Usage in services
export class ProjectService {
  static async update(projectId: string, teamId: string, userId: string, data: UpdateData) {
    // Get old values for audit
    const [oldProject] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    
    // Update
    const [newProject] = await db
      .update(projects)
      .set(data)
      .where(eq(projects.id, projectId))
      .returning();
    
    // Log audit
    await AuditService.log({
      teamId,
      userId,
      action: 'update',
      entityType: 'project',
      entityId: projectId,
      oldValues: oldProject,
      newValues: newProject,
    });
    
    return newProject;
  }
}
```

---


---

# PART 56: DATABASE MIGRATIONS

## Drizzle Migration Workflow

```bash
# Generate migration from schema changes
npx drizzle-kit generate:pg

# Apply migrations
npx drizzle-kit push:pg

# View migration status
npx drizzle-kit check:pg
```

## Safe Migration Patterns

```typescript
// drizzle/migrations/0001_add_user_avatar.sql

-- Safe: Add nullable column
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Safe: Add column with default
ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Safe: Add index (use CONCURRENTLY in production)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- UNSAFE: Don't do these in production without planning
-- ALTER TABLE users DROP COLUMN old_field;  -- Data loss!
-- ALTER TABLE users ALTER COLUMN name SET NOT NULL;  -- Might fail!
```

## Migration with Data Backfill

```typescript
// drizzle/migrations/0002_split_name.sql

-- Step 1: Add new columns
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;

-- Step 2: Backfill data
UPDATE users SET 
  first_name = split_part(name, ' ', 1),
  last_name = substring(name from position(' ' in name) + 1);

-- Step 3: Make required (after backfill verified)
-- ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;

-- Step 4: Drop old column (after app updated)
-- ALTER TABLE users DROP COLUMN name;
```

## Zero-Downtime Migration Pattern

```
Phase 1: Add new columns (nullable)
↓ Deploy app that writes to BOTH old and new
Phase 2: Backfill old data
↓ Verify data integrity
Phase 3: Deploy app that reads from NEW only
↓ Verify app works
Phase 4: Deploy app that writes to NEW only
↓ Verify app works
Phase 5: Drop old columns
```

---


---

# PART 63: SOFT DELETES

## Schema with Soft Delete

```typescript
// db/schema.ts
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  // Soft delete fields
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => profiles.id),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

## Soft Delete Service

```typescript
// services/project-service.ts
import { isNull } from 'drizzle-orm';

export class ProjectService {
  // Only get non-deleted by default
  static async getAll(teamId: string, includeDeleted = false) {
    let query = db
      .select()
      .from(projects)
      .where(eq(projects.teamId, teamId));
    
    if (!includeDeleted) {
      query = query.where(isNull(projects.deletedAt));
    }
    
    return query;
  }
  
  // Soft delete
  static async delete(projectId: string, userId: string) {
    await db
      .update(projects)
      .set({
        deletedAt: new Date(),
        deletedBy: userId,
      })
      .where(eq(projects.id, projectId));
  }
  
  // Restore
  static async restore(projectId: string) {
    await db
      .update(projects)
      .set({
        deletedAt: null,
        deletedBy: null,
      })
      .where(eq(projects.id, projectId));
  }
  
  // Permanent delete (admin only)
  static async permanentDelete(projectId: string) {
    await db
      .delete(projects)
      .where(eq(projects.id, projectId));
  }
  
  // Get deleted items (trash)
  static async getTrash(teamId: string) {
    return db
      .select()
      .from(projects)
      .where(and(
        eq(projects.teamId, teamId),
        isNotNull(projects.deletedAt)
      ))
      .orderBy(desc(projects.deletedAt));
  }
  
  // Auto-cleanup old deleted items
  static async cleanupOldDeleted(daysOld: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    await db
      .delete(projects)
      .where(and(
        isNotNull(projects.deletedAt),
        lt(projects.deletedAt, cutoff)
      ));
  }
}
```

---

