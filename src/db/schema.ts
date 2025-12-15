import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const subscriptionPlanEnum = pgEnum('subscription_plan', ['beta', 'pro', 'team', 'agency']);

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

  // Stripe
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').default('inactive'),
  subscriptionPlan: subscriptionPlanEnum('subscription_plan'),

  // Beta / Admin-granted access (no restrictions)
  betaGrantedAt: timestamp('beta_granted_at'),
  betaGrantedReason: text('beta_granted_reason'),

  // Free trial usage tracking
  freeDownloadsUsed: integer('free_downloads_used').default(0),
  freeDownloadsLimit: integer('free_downloads_limit').default(3),

  // Suspension (admin action for unpaid, abuse, etc.)
  suspendedAt: timestamp('suspended_at'),
  suspendedReason: text('suspended_reason'),

  seatLimit: integer('seat_limit').default(1),
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
  modulesContent: text('modules_content'),

  // Metadata
  changelog: text('changelog'),
  publishedBy: uuid('published_by').references(() => profiles.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  publishedAt: timestamp('published_at'),
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
