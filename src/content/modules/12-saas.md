# SAAS PATTERNS
# Module: 12-saas.md
# Load with: 00-core.md, 01-database.md, 02-auth.md

---

## 🏢 MULTI-TENANT ARCHITECTURE

### Database Schema for Multi-Tenancy

```typescript
// db/schema/tenancy.ts
import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';

// Organization/Team is the tenant
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  
  // Billing
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionPlan: text('subscription_plan').default('free'),
  subscriptionStatus: text('subscription_status').default('inactive'),
  subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end'),
  
  // Limits based on plan
  seatLimit: integer('seat_limit').default(1),
  storageLimit: integer('storage_limit').default(1073741824), // 1GB in bytes
  apiCallsLimit: integer('api_calls_limit').default(1000),
  
  // Settings
  settings: jsonb('settings').$type<OrganizationSettings>().default({}),
  
  // Feature flags (per-org overrides)
  features: jsonb('features').$type<Record<string, boolean>>().default({}),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  slugIdx: uniqueIndex('org_slug_idx').on(table.slug),
}));

export interface OrganizationSettings {
  timezone?: string;
  dateFormat?: string;
  defaultRole?: string;
  allowSignup?: boolean;
  ssoEnabled?: boolean;
  ssoProvider?: string;
  customDomain?: string;
  brandColor?: string;
  notificationPreferences?: Record<string, boolean>;
}

// Organization members
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // owner, admin, member, viewer
  invitedAt: timestamp('invited_at'),
  invitedBy: uuid('invited_by').references(() => users.id),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgUserIdx: uniqueIndex('org_member_unique').on(table.organizationId, table.userId),
  orgIdx: index('org_member_org_idx').on(table.organizationId),
  userIdx: index('org_member_user_idx').on(table.userId),
}));

// Invitations
export const organizationInvitations = pgTable('organization_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  invitedBy: uuid('invited_by').references(() => users.id),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('invitation_token_idx').on(table.token),
  emailOrgIdx: index('invitation_email_org_idx').on(table.email, table.organizationId),
}));

// Usage tracking
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  metric: text('metric').notNull(), // api_calls, storage, seats, etc.
  value: integer('value').notNull(),
  period: text('period').notNull(), // YYYY-MM format
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgMetricPeriodIdx: uniqueIndex('usage_org_metric_period').on(table.organizationId, table.metric, table.period),
}));
```

---

## 🔐 TENANT CONTEXT & ISOLATION

```typescript
// lib/tenant-context.ts
import { AsyncLocalStorage } from 'async_hooks';
import { db } from '@/db';
import { organizations, organizationMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface TenantContext {
  organizationId: string;
  userId: string;
  role: string;
  plan: string;
  features: Record<string, boolean>;
}

// AsyncLocalStorage for tenant context
const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function requireTenantContext(): TenantContext {
  const context = tenantStorage.getStore();
  if (!context) {
    throw new Error('No tenant context available');
  }
  return context;
}

export async function withTenantContext<T>(
  organizationId: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Load org and membership
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error('Organization not found');
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new Error('User not a member of organization');
  }

  const context: TenantContext = {
    organizationId,
    userId,
    role: membership.role,
    plan: org.subscriptionPlan || 'free',
    features: org.features || {},
  };

  return tenantStorage.run(context, fn);
}

// Middleware for API routes
export async function tenantMiddleware(
  req: Request,
  organizationId: string,
  userId: string
) {
  return withTenantContext(organizationId, userId, async () => {
    // Request handler runs with tenant context
  });
}
```

---

## 🚪 ROW-LEVEL SECURITY (RLS)

```sql
-- migrations/0001_enable_rls.sql

-- Enable RLS on all tenant-scoped tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Users can view org projects"
  ON projects FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete projects"
  ON projects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- Function to get current user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## 🎚️ FEATURE FLAGS

```typescript
// lib/feature-flags.ts
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Global feature flag definitions
export const FEATURES = {
  // Core features
  API_ACCESS: 'api_access',
  WEBHOOKS: 'webhooks',
  CUSTOM_DOMAIN: 'custom_domain',
  SSO: 'sso',
  AUDIT_LOG: 'audit_log',
  
  // Advanced features
  ADVANCED_ANALYTICS: 'advanced_analytics',
  WHITE_LABEL: 'white_label',
  PRIORITY_SUPPORT: 'priority_support',
  CUSTOM_BRANDING: 'custom_branding',
  
  // Beta features
  AI_ASSISTANT: 'ai_assistant',
  BATCH_OPERATIONS: 'batch_operations',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

// Plan-based feature matrix
const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  free: [],
  pro: [
    FEATURES.API_ACCESS,
    FEATURES.WEBHOOKS,
  ],
  team: [
    FEATURES.API_ACCESS,
    FEATURES.WEBHOOKS,
    FEATURES.CUSTOM_DOMAIN,
    FEATURES.AUDIT_LOG,
    FEATURES.ADVANCED_ANALYTICS,
  ],
  agency: [
    FEATURES.API_ACCESS,
    FEATURES.WEBHOOKS,
    FEATURES.CUSTOM_DOMAIN,
    FEATURES.SSO,
    FEATURES.AUDIT_LOG,
    FEATURES.ADVANCED_ANALYTICS,
    FEATURES.WHITE_LABEL,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.CUSTOM_BRANDING,
  ],
};

export class FeatureFlags {
  private organizationId: string;
  private plan: string;
  private overrides: Record<string, boolean>;

  constructor(organizationId: string, plan: string, overrides: Record<string, boolean> = {}) {
    this.organizationId = organizationId;
    this.plan = plan;
    this.overrides = overrides;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: FeatureKey): boolean {
    // Check overrides first (can enable OR disable)
    if (feature in this.overrides) {
      return this.overrides[feature];
    }

    // Check plan features
    const planFeatures = PLAN_FEATURES[this.plan] || [];
    return planFeatures.includes(feature);
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(): FeatureKey[] {
    const planFeatures = PLAN_FEATURES[this.plan] || [];
    const allFeatures = new Set(planFeatures);

    // Apply overrides
    for (const [feature, enabled] of Object.entries(this.overrides)) {
      if (enabled) {
        allFeatures.add(feature as FeatureKey);
      } else {
        allFeatures.delete(feature as FeatureKey);
      }
    }

    return Array.from(allFeatures);
  }

  /**
   * Require a feature or throw
   */
  require(feature: FeatureKey): void {
    if (!this.isEnabled(feature)) {
      throw new FeatureNotAvailableError(feature, this.plan);
    }
  }

  /**
   * Load feature flags for an organization
   */
  static async forOrganization(organizationId: string): Promise<FeatureFlags> {
    const [org] = await db
      .select({
        plan: organizations.subscriptionPlan,
        features: organizations.features,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    return new FeatureFlags(
      organizationId,
      org.plan || 'free',
      org.features || {}
    );
  }
}

export class FeatureNotAvailableError extends Error {
  constructor(public feature: string, public currentPlan: string) {
    super(`Feature "${feature}" is not available on the ${currentPlan} plan`);
    this.name = 'FeatureNotAvailableError';
  }
}

// React hook for feature flags
export function useFeatureFlags() {
  const { organization } = useOrganization(); // Your org context hook
  
  const flags = useMemo(() => {
    if (!organization) return null;
    return new FeatureFlags(
      organization.id,
      organization.subscriptionPlan || 'free',
      organization.features || {}
    );
  }, [organization]);

  return {
    isEnabled: (feature: FeatureKey) => flags?.isEnabled(feature) ?? false,
    enabledFeatures: flags?.getEnabledFeatures() ?? [],
  };
}

// Feature gate component
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isEnabled } = useFeatureFlags();
  
  if (!isEnabled(feature)) {
    return fallback;
  }
  
  return children;
}
```

---

## 📊 USAGE TRACKING & LIMITS

```typescript
// services/usage-service.ts
import { db } from '@/db';
import { organizations, usageRecords, organizationMembers } from '@/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';

interface UsageLimits {
  seats: { used: number; limit: number };
  storage: { used: number; limit: number };
  apiCalls: { used: number; limit: number };
}

export class UsageService {
  /**
   * Get current usage for an organization
   */
  static async getUsage(organizationId: string): Promise<UsageLimits> {
    const [org] = await db
      .select({
        seatLimit: organizations.seatLimit,
        storageLimit: organizations.storageLimit,
        apiCallsLimit: organizations.apiCallsLimit,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Count current seats
    const [seatCount] = await db
      .select({ count: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    // Get current month's API calls
    const currentPeriod = this.getCurrentPeriod();
    const [apiUsage] = await db
      .select({ value: usageRecords.value })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          eq(usageRecords.metric, 'api_calls'),
          eq(usageRecords.period, currentPeriod)
        )
      )
      .limit(1);

    // Get storage usage
    const [storageUsage] = await db
      .select({ value: usageRecords.value })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          eq(usageRecords.metric, 'storage')
        )
      )
      .limit(1);

    return {
      seats: {
        used: seatCount?.count || 0,
        limit: org.seatLimit || 1,
      },
      storage: {
        used: storageUsage?.value || 0,
        limit: org.storageLimit || 1073741824,
      },
      apiCalls: {
        used: apiUsage?.value || 0,
        limit: org.apiCallsLimit || 1000,
      },
    };
  }

  /**
   * Check if organization is within limits
   */
  static async checkLimit(
    organizationId: string,
    metric: 'seats' | 'storage' | 'apiCalls',
    additionalUsage: number = 1
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const usage = await this.getUsage(organizationId);
    const { used, limit } = usage[metric];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, current: used, limit };
    }

    return {
      allowed: used + additionalUsage <= limit,
      current: used,
      limit,
    };
  }

  /**
   * Increment usage counter
   */
  static async incrementUsage(
    organizationId: string,
    metric: string,
    amount: number = 1
  ): Promise<void> {
    const period = this.getCurrentPeriod();

    await db
      .insert(usageRecords)
      .values({
        organizationId,
        metric,
        value: amount,
        period,
      })
      .onConflictDoUpdate({
        target: [usageRecords.organizationId, usageRecords.metric, usageRecords.period],
        set: {
          value: sql`${usageRecords.value} + ${amount}`,
        },
      });
  }

  /**
   * Set absolute usage value (for storage)
   */
  static async setUsage(
    organizationId: string,
    metric: string,
    value: number
  ): Promise<void> {
    const period = this.getCurrentPeriod();

    await db
      .insert(usageRecords)
      .values({
        organizationId,
        metric,
        value,
        period,
      })
      .onConflictDoUpdate({
        target: [usageRecords.organizationId, usageRecords.metric, usageRecords.period],
        set: { value },
      });
  }

  private static getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

// Middleware for API rate limiting based on plan
export async function checkApiLimit(organizationId: string): Promise<void> {
  const check = await UsageService.checkLimit(organizationId, 'apiCalls');
  
  if (!check.allowed) {
    throw new UsageLimitExceededError('apiCalls', check.current, check.limit);
  }

  // Increment usage
  await UsageService.incrementUsage(organizationId, 'api_calls');
}

export class UsageLimitExceededError extends Error {
  constructor(
    public metric: string,
    public current: number,
    public limit: number
  ) {
    super(`Usage limit exceeded for ${metric}: ${current}/${limit}`);
    this.name = 'UsageLimitExceededError';
  }
}
```

---

## 👥 TEAM MANAGEMENT

```typescript
// services/team-service.ts
import { db } from '@/db';
import { organizations, organizationMembers, organizationInvitations, users } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { UsageService } from './usage-service';

interface InviteOptions {
  organizationId: string;
  email: string;
  role: string;
  invitedBy: string;
}

export class TeamService {
  /**
   * Get team members
   */
  static async getMembers(organizationId: string) {
    return db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        acceptedAt: organizationMembers.acceptedAt,
        user: {
          email: users.email,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, organizationId));
  }

  /**
   * Invite a new member
   */
  static async inviteMember(options: InviteOptions): Promise<string> {
    const { organizationId, email, role, invitedBy } = options;

    // Check seat limit
    const seatCheck = await UsageService.checkLimit(organizationId, 'seats');
    if (!seatCheck.allowed) {
      throw new Error(`Seat limit reached (${seatCheck.current}/${seatCheck.limit})`);
    }

    // Check if user already member
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, existingUser.id)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new Error('User is already a member');
      }
    }

    // Check for existing pending invitation
    const [existingInvite] = await db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.email, email.toLowerCase()),
          gt(organizationInvitations.expiresAt, new Date())
        )
      )
      .limit(1);

    if (existingInvite) {
      throw new Error('Invitation already pending');
    }

    // Create invitation
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(organizationInvitations).values({
      organizationId,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt,
      invitedBy,
    });

    // TODO: Send invitation email
    // await sendInvitationEmail(email, token, organizationId);

    return token;
  }

  /**
   * Accept invitation
   */
  static async acceptInvitation(token: string, userId: string): Promise<void> {
    const [invitation] = await db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.token, token),
          gt(organizationInvitations.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    if (invitation.acceptedAt) {
      throw new Error('Invitation already accepted');
    }

    // Verify user email matches invitation
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.email.toLowerCase() !== invitation.email) {
      throw new Error('Email does not match invitation');
    }

    // Add member
    await db.insert(organizationMembers).values({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.createdAt,
      acceptedAt: new Date(),
    });

    // Mark invitation as accepted
    await db
      .update(organizationInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));
  }

  /**
   * Remove member
   */
  static async removeMember(
    organizationId: string,
    memberId: string,
    removedBy: string
  ): Promise<void> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!member) {
      throw new Error('Member not found');
    }

    // Can't remove owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove organization owner');
    }

    // Can't remove yourself (use leave instead)
    if (member.userId === removedBy) {
      throw new Error('Use leave organization instead');
    }

    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, memberId));
  }

  /**
   * Update member role
   */
  static async updateRole(
    organizationId: string,
    memberId: string,
    newRole: string,
    updatedBy: string
  ): Promise<void> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!member) {
      throw new Error('Member not found');
    }

    // Can't change owner role
    if (member.role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    // Can't promote to owner
    if (newRole === 'owner') {
      throw new Error('Use transfer ownership instead');
    }

    await db
      .update(organizationMembers)
      .set({ role: newRole })
      .where(eq(organizationMembers.id, memberId));
  }

  /**
   * Transfer ownership
   */
  static async transferOwnership(
    organizationId: string,
    newOwnerId: string,
    currentOwnerId: string
  ): Promise<void> {
    // Verify current owner
    const [currentOwner] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, currentOwnerId),
          eq(organizationMembers.role, 'owner')
        )
      )
      .limit(1);

    if (!currentOwner) {
      throw new Error('Not the organization owner');
    }

    // Verify new owner is a member
    const [newOwnerMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, newOwnerId)
        )
      )
      .limit(1);

    if (!newOwnerMember) {
      throw new Error('New owner must be an existing member');
    }

    // Update roles in transaction
    await db.transaction(async (tx) => {
      await tx
        .update(organizationMembers)
        .set({ role: 'admin' })
        .where(eq(organizationMembers.id, currentOwner.id));

      await tx
        .update(organizationMembers)
        .set({ role: 'owner' })
        .where(eq(organizationMembers.id, newOwnerMember.id));

      await tx
        .update(organizations)
        .set({ ownerId: newOwnerId, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId));
    });
  }
}
```

---

## 🔒 GDPR & DATA PRIVACY

```typescript
// services/gdpr-service.ts
import { db } from '@/db';
import { users, organizations, organizationMembers, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class GDPRService {
  /**
   * Export all user data (Data Portability)
   */
  static async exportUserData(userId: string): Promise<UserDataExport> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Get all organizations user belongs to
    const memberships = await db
      .select({
        organization: organizations,
        membership: organizationMembers,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId));

    // Get user's content (customize based on your data model)
    // const projects = await db.select()...
    // const documents = await db.select()...

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.membership.role,
        joinedAt: m.membership.acceptedAt,
      })),
      // Add more data sections as needed
    };
  }

  /**
   * Delete user account (Right to Erasure)
   */
  static async deleteUserAccount(userId: string): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user owns any organizations
    const ownedOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerId, userId));

    if (ownedOrgs.length > 0) {
      throw new Error(
        'Cannot delete account while owning organizations. Transfer or delete them first.'
      );
    }

    await db.transaction(async (tx) => {
      // Remove from all organizations
      await tx
        .delete(organizationMembers)
        .where(eq(organizationMembers.userId, userId));

      // Anonymize audit logs (keep for compliance but remove PII)
      await tx
        .update(auditLogs)
        .set({ userId: null, userEmail: '[deleted]' })
        .where(eq(auditLogs.userId, userId));

      // Delete user
      await tx.delete(users).where(eq(users.id, userId));
    });

    // Log deletion for compliance
    console.log(`User account deleted: ${userId}`);
  }

  /**
   * Get data processing consent status
   */
  static async getConsentStatus(userId: string): Promise<ConsentStatus> {
    const [user] = await db
      .select({
        marketingConsent: users.marketingConsent,
        analyticsConsent: users.analyticsConsent,
        consentUpdatedAt: users.consentUpdatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      marketing: user?.marketingConsent ?? false,
      analytics: user?.analyticsConsent ?? false,
      updatedAt: user?.consentUpdatedAt?.toISOString(),
    };
  }

  /**
   * Update consent preferences
   */
  static async updateConsent(
    userId: string,
    consent: { marketing?: boolean; analytics?: boolean }
  ): Promise<void> {
    await db
      .update(users)
      .set({
        ...(consent.marketing !== undefined && { marketingConsent: consent.marketing }),
        ...(consent.analytics !== undefined && { analyticsConsent: consent.analytics }),
        consentUpdatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

interface UserDataExport {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date | null;
  };
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    joinedAt: Date | null;
  }>;
}

interface ConsentStatus {
  marketing: boolean;
  analytics: boolean;
  updatedAt?: string;
}
```

---

## 📝 AUDIT LOGGING

```typescript
// services/audit-service.ts
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getTenantContext } from '@/lib/tenant-context';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  | 'org.created'
  | 'org.updated'
  | 'org.deleted'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'settings.updated'
  | 'data.exported'
  | 'data.deleted';

interface AuditEntry {
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Log an audit event
   */
  static async log(entry: AuditEntry): Promise<void> {
    const context = getTenantContext();

    await db.insert(auditLogs).values({
      organizationId: context?.organizationId,
      userId: context?.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
  }

  /**
   * Get audit logs for organization
   */
  static async getOrgLogs(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const { limit = 50, offset = 0 } = options;

    let query = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Add filters
    if (options.action) {
      query = query.where(eq(auditLogs.action, options.action));
    }
    if (options.userId) {
      query = query.where(eq(auditLogs.userId, options.userId));
    }
    // Add date filters...

    return query;
  }

  /**
   * Get user's audit trail
   */
  static async getUserLogs(userId: string, limit = 100) {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

// Usage in API routes
export async function logApiAction(
  req: Request,
  action: AuditAction,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  await AuditService.log({
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress: req.headers.get('x-forwarded-for') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  });
}
```

---

## 🎯 SAAS CHECKLIST

```markdown
## Multi-Tenant SaaS Checklist

### Data Isolation
- [ ] Organization-scoped tables have org_id
- [ ] All queries filter by organization
- [ ] RLS policies enabled where applicable
- [ ] Cross-tenant access prevented

### Authentication & Authorization
- [ ] Users belong to organizations
- [ ] Role-based permissions (owner/admin/member/viewer)
- [ ] Invitation system works
- [ ] SSO integration (Team+ plans)

### Billing & Subscriptions
- [ ] Stripe integration complete
- [ ] Plan limits enforced
- [ ] Usage tracking implemented
- [ ] Upgrade/downgrade flows work

### Feature Flags
- [ ] Plan-based features defined
- [ ] Per-org overrides supported
- [ ] Feature gates in UI
- [ ] API checks features

### Compliance
- [ ] GDPR data export
- [ ] Account deletion
- [ ] Consent management
- [ ] Audit logging
- [ ] Data retention policies

### Team Management
- [ ] Invite members
- [ ] Remove members
- [ ] Change roles
- [ ] Transfer ownership
- [ ] Seat limits enforced
```

---
