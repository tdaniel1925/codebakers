import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const subscriptionPlanEnum = pgEnum('subscription_plan', ['beta', 'pro', 'team', 'agency', 'enterprise']);
export const paymentProviderEnum = pgEnum('payment_provider', ['stripe', 'square', 'paypal']);

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').references(() => profiles.id, { onDelete: 'cascade' }),

  // Payment provider used for this subscription
  paymentProvider: paymentProviderEnum('payment_provider'),

  // Stripe
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),

  // Square
  squareCustomerId: text('square_customer_id'),
  squareSubscriptionId: text('square_subscription_id'),

  // PayPal
  paypalSubscriptionId: text('paypal_subscription_id'),

  // Subscription details (provider-agnostic)
  subscriptionStatus: text('subscription_status').default('inactive'),
  subscriptionPlan: subscriptionPlanEnum('subscription_plan'),

  // Beta / Admin-granted access (no restrictions)
  betaGrantedAt: timestamp('beta_granted_at'),
  betaGrantedReason: text('beta_granted_reason'),

  // Free trial - unlimited downloads but locked to one project
  freeTrialProjectId: text('free_trial_project_id'), // Hash of project path or git remote
  freeTrialProjectName: text('free_trial_project_name'), // Friendly name for display

  // Legacy download tracking (kept for backwards compatibility)
  freeDownloadsUsed: integer('free_downloads_used').default(0),
  freeDownloadsLimit: integer('free_downloads_limit').default(10),

  // Onboarding tracking
  onboardingCompletedAt: timestamp('onboarding_completed_at'),

  // Suspension (admin action for unpaid, abuse, etc.)
  suspendedAt: timestamp('suspended_at'),
  suspendedReason: text('suspended_reason'),

  seatLimit: integer('seat_limit').default(1),

  // Pattern versioning - allow teams to pin to a specific version
  pinnedPatternVersion: text('pinned_pattern_version'),

  // Service API keys for auto-provisioning (JSON: { github, supabase, vercel })
  serviceKeys: text('service_keys'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  role: text('role').default('member'),
  invitedAt: timestamp('invited_at').defaultNow(),
  joinedAt: timestamp('joined_at'),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  keyPlain: text('key_plain'), // Store full key so user can always copy it
  name: text('name').default('Default'),
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Content Versions - track uploaded content versions
export const contentVersions = pgTable('content_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: text('version').notNull(),

  // Content files (stored as text)
  routerContent: text('router_content'),
  cursorRulesContent: text('cursor_rules_content'),
  claudeMdContent: text('claude_md_content'),

  // Module files stored as JSON { "00-core.md": "content", ... }
  modulesContent: text('modules_content'), // .claude/ folder for Claude Code
  cursorModulesContent: text('cursor_modules_content'), // .cursorrules-modules/ folder for Cursor

  // Metadata
  changelog: text('changelog'),
  publishedBy: uuid('published_by').references(() => profiles.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  publishedAt: timestamp('published_at'),
});

// Subscription Pricing - admin-configurable pricing for each plan/provider
export const subscriptionPricing = pgTable('subscription_pricing', {
  id: uuid('id').primaryKey().defaultRandom(),
  plan: subscriptionPlanEnum('plan').notNull(),

  // Display info
  name: text('name').notNull(),
  description: text('description'),
  features: text('features'), // JSON array of feature strings
  seats: integer('seats').notNull().default(1),

  // Pricing in cents (e.g., 4900 = $49.00)
  priceMonthly: integer('price_monthly').notNull(),
  priceYearly: integer('price_yearly'), // Optional yearly price

  // Provider-specific price/plan IDs
  stripePriceId: text('stripe_price_id'),
  stripeYearlyPriceId: text('stripe_yearly_price_id'),
  squarePlanId: text('square_plan_id'),
  squareYearlyPlanId: text('square_yearly_plan_id'),
  paypalPlanId: text('paypal_plan_id'),
  paypalYearlyPlanId: text('paypal_yearly_plan_id'),

  // Status
  isActive: boolean('is_active').default(true),
  displayOrder: integer('display_order').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Enterprise Inquiries - track enterprise plan inquiries
export const enterpriseInquiries = pgTable('enterprise_inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company').notNull(),
  teamSize: text('team_size'),
  useCase: text('use_case'),
  status: text('status').default('new'), // new, contacted, converted, declined
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  respondedAt: timestamp('responded_at'),
});

// Module Reports - track outdated module reports from users
export const moduleReports = pgTable('module_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // What's outdated
  moduleName: text('module_name').notNull(),
  issue: text('issue').notNull(),
  modulePattern: text('module_pattern'),
  currentPattern: text('current_pattern'),
  sourceUrl: text('source_url'),

  // Who reported
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),

  // Status: pending, acknowledged, fixed, dismissed
  status: text('status').default('pending'),
  fixedInVersion: text('fixed_in_version'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at'),
  fixedAt: timestamp('fixed_at'),
});

// Pattern Submissions - AI-generated patterns submitted for admin review
export const patternSubmissions = pgTable('pattern_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Pattern details
  name: text('name').notNull(), // e.g., "email-sendgrid"
  content: text('content').notNull(), // The full pattern markdown
  description: text('description'), // Brief description of what it does
  basePattern: text('base_pattern'), // Which existing pattern it's based on (if any)
  category: text('category'), // e.g., "integrations", "auth", "payments"

  // Why the AI submitted this
  reason: text('reason'), // AI's explanation of why this pattern is useful
  userContext: text('user_context'), // What the user was trying to do

  // AI Analysis (generated on submission)
  aiSummary: text('ai_summary'), // AI-generated summary for admin review
  aiRating: integer('ai_rating'), // 1-10 rating of pattern quality
  aiRecommendation: text('ai_recommendation'), // "approve", "review", "reject"
  aiAnalysis: text('ai_analysis'), // Detailed analysis JSON

  // Who submitted
  submittedByTeamId: uuid('submitted_by_team_id').references(() => teams.id, { onDelete: 'set null' }),

  // Review status: pending, approved, rejected
  status: text('status').default('pending'),
  adminNotes: text('admin_notes'),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),

  // If approved, which version it was added to
  addedToVersion: text('added_to_version'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

// Pattern Usage - track which patterns are being fetched for analytics
export const patternUsage = pgTable('pattern_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  patternName: text('pattern_name').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});

// Team Invites - pending invitations to join teams
export const teamInvites = pgTable('team_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  role: text('role').default('member').notNull(),
  invitedBy: uuid('invited_by').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedTeams: many(teams),
  teamMemberships: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [teams.ownerId],
    references: [profiles.id],
  }),
  members: many(teamMembers),
  apiKeys: many(apiKeys),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(profiles, {
    fields: [teamMembers.userId],
    references: [profiles.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  team: one(teams, {
    fields: [apiKeys.teamId],
    references: [teams.id],
  }),
}));

// Types
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ModuleReport = typeof moduleReports.$inferSelect;
export type NewModuleReport = typeof moduleReports.$inferInsert;
export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;
export type SubscriptionPricing = typeof subscriptionPricing.$inferSelect;
export type NewSubscriptionPricing = typeof subscriptionPricing.$inferInsert;
export type EnterpriseInquiry = typeof enterpriseInquiries.$inferSelect;
export type NewEnterpriseInquiry = typeof enterpriseInquiries.$inferInsert;
export type PatternSubmission = typeof patternSubmissions.$inferSelect;
export type NewPatternSubmission = typeof patternSubmissions.$inferInsert;
export type PatternUsage = typeof patternUsage.$inferSelect;
export type NewPatternUsage = typeof patternUsage.$inferInsert;
export type TeamInvite = typeof teamInvites.$inferSelect;
export type NewTeamInvite = typeof teamInvites.$inferInsert;
export type PaymentProvider = 'stripe' | 'square' | 'paypal';
