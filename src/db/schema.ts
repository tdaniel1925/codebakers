import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const subscriptionPlanEnum = pgEnum('subscription_plan', ['beta', 'pro', 'team', 'agency', 'enterprise']);
export const paymentProviderEnum = pgEnum('payment_provider', ['stripe', 'square', 'paypal']);
export const trialStageEnum = pgEnum('trial_stage', ['anonymous', 'extended', 'expired', 'converted']);

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
  freeTrialExpiresAt: timestamp('free_trial_expires_at'), // When free trial ends (7 days from signup)

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

// Pattern Gaps - track when AI encounters missing patterns
export const patternGaps = pgTable('pattern_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),

  // What was requested
  category: text('category').notNull(), // e.g., "third-party-apis", "mobile", "blockchain"
  request: text('request').notNull(), // What the user asked for
  context: text('context'), // Additional context about the request

  // How it was handled
  handledWith: text('handled_with'), // Which patterns were used as fallback
  wasSuccessful: boolean('was_successful').default(true),

  // Who reported (optional - CLI might not have auth context)
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),

  // Admin review
  status: text('status').default('new'), // new, reviewed, pattern_added, dismissed
  adminNotes: text('admin_notes'),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

export type PatternGap = typeof patternGaps.$inferSelect;
export type NewPatternGap = typeof patternGaps.$inferInsert;

// CLI Analytics - track CLI usage patterns for learning
export const cliAnalytics = pgTable('cli_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Event type
  eventType: text('event_type').notNull(), // e.g., "trigger_fired", "trigger_accepted", "topic_learned"
  eventData: text('event_data'), // JSON with event-specific data

  // Source
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  projectHash: text('project_hash'), // Hash of project path for grouping

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

export type CliAnalytics = typeof cliAnalytics.$inferSelect;
export type NewCliAnalytics = typeof cliAnalytics.$inferInsert;

// Trial Fingerprints - device-based trial tracking for zero-friction onboarding
export const trialFingerprints = pgTable('trial_fingerprints', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Device identification (hashed for privacy)
  deviceHash: text('device_hash').notNull().unique(),
  machineId: text('machine_id'),

  // User identification (progressive - starts anonymous, may add GitHub later)
  githubId: text('github_id').unique(),
  githubUsername: text('github_username'),
  email: text('email'),

  // Network info (soft signal for abuse detection)
  ipAddress: text('ip_address'),

  // Trial state
  trialStage: trialStageEnum('trial_stage').default('anonymous'),
  trialStartedAt: timestamp('trial_started_at').defaultNow(),
  trialExtendedAt: timestamp('trial_extended_at'),
  trialExpiresAt: timestamp('trial_expires_at'),

  // Project lock (same as existing team-based trial)
  projectId: text('project_id'),
  projectName: text('project_name'),

  // Conversion tracking
  convertedToTeamId: uuid('converted_to_team_id').references(() => teams.id, { onDelete: 'set null' }),
  convertedAt: timestamp('converted_at'),

  // Re-trial tracking (one-time only after 30+ days expired)
  retrialUsedAt: timestamp('retrial_used_at'),

  // Anti-abuse flags
  flagged: boolean('flagged').default(false),
  flagReason: text('flag_reason'),

  // Metadata
  platform: text('platform'), // win32, darwin, linux
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type TrialFingerprint = typeof trialFingerprints.$inferSelect;
export type NewTrialFingerprint = typeof trialFingerprints.$inferInsert;

// CLI Version Status enum
export const cliVersionStatusEnum = pgEnum('cli_version_status', ['draft', 'testing', 'stable', 'deprecated', 'blocked']);

// CLI Versions - complete admin control over CLI version rollouts
export const cliVersions = pgTable('cli_versions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Version info
  version: text('version').notNull().unique(), // e.g., "1.2.5"
  npmTag: text('npm_tag').default('latest'), // npm tag: latest, beta, next

  // Status control
  status: cliVersionStatusEnum('status').default('draft'),
  // draft = just published, not rolled out
  // testing = internal testing only
  // stable = safe for all users (auto-update target)
  // deprecated = still works, but users should update
  // blocked = critical bug, prevent usage

  // Feature flags for this version
  minNodeVersion: text('min_node_version').default('18'), // Minimum Node.js required
  features: text('features'), // JSON array of feature flags enabled

  // Changelog
  changelog: text('changelog'), // What's new in this version
  breakingChanges: text('breaking_changes'), // Any breaking changes

  // Rollout control
  rolloutPercent: integer('rollout_percent').default(0), // 0-100, for gradual rollout
  isAutoUpdateEnabled: boolean('is_auto_update_enabled').default(false), // Can MCP auto-update to this?

  // Admin metadata
  publishedBy: uuid('published_by').references(() => profiles.id, { onDelete: 'set null' }),
  testedBy: uuid('tested_by').references(() => profiles.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => profiles.id, { onDelete: 'set null' }),

  // Error tracking
  errorCount: integer('error_count').default(0), // Auto-incremented by error reports
  lastErrorAt: timestamp('last_error_at'),

  // Timestamps
  publishedAt: timestamp('published_at'), // When it was published to npm
  testedAt: timestamp('tested_at'), // When testing was completed
  stableAt: timestamp('stable_at'), // When marked as stable
  deprecatedAt: timestamp('deprecated_at'),
  blockedAt: timestamp('blocked_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type CliVersion = typeof cliVersions.$inferSelect;
export type NewCliVersion = typeof cliVersions.$inferInsert;
export type CliVersionStatus = 'draft' | 'testing' | 'stable' | 'deprecated' | 'blocked';

// CLI Error Reports - track errors from CLI installations
export const cliErrorReports = pgTable('cli_error_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Version info
  cliVersion: text('cli_version').notNull(),
  nodeVersion: text('node_version'),
  platform: text('platform'), // win32, darwin, linux

  // Error details
  errorType: text('error_type').notNull(), // e.g., "install_failed", "mcp_crash", "api_error"
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  command: text('command'), // Which command failed

  // Context
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  deviceHash: text('device_hash'), // For trial users

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

export type CliErrorReport = typeof cliErrorReports.$inferSelect;
export type NewCliErrorReport = typeof cliErrorReports.$inferInsert;

// ============================================
// PROJECT TRACKING - Agency-Style Build Dashboard
// ============================================

// Project Status enum
export const projectStatusEnum = pgEnum('project_status', ['discovery', 'planning', 'building', 'testing', 'completed', 'paused', 'failed']);

// Phase Status enum
export const phaseStatusEnum = pgEnum('phase_status', ['pending', 'in_progress', 'completed', 'skipped', 'failed']);

// Feature Status enum
export const featureStatusEnum = pgEnum('feature_status', ['pending', 'in_progress', 'completed', 'blocked', 'failed']);

// Event Type enum
export const eventTypeEnum = pgEnum('event_type', [
  'project_started', 'project_completed', 'project_paused', 'project_failed',
  'phase_started', 'phase_completed', 'phase_skipped', 'phase_failed',
  'feature_started', 'feature_completed', 'feature_blocked', 'feature_failed',
  'file_created', 'file_modified', 'file_deleted',
  'test_started', 'test_passed', 'test_failed',
  'approval_requested', 'approval_granted', 'approval_rejected',
  'snapshot_created', 'snapshot_restored',
  'ai_decision', 'ai_confidence', 'risk_flagged',
  'docs_generated', 'dependency_added', 'dependency_removed'
]);

// Risk Level enum
export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high', 'critical']);

// Projects - Main project record (server-side backup of .codebakers.json)
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),

  // Project identification
  projectHash: text('project_hash').notNull(), // Hash of project path/git remote
  projectName: text('project_name').notNull(),
  projectDescription: text('project_description'),

  // Public progress page
  publicSlug: text('public_slug').unique(), // URL-safe slug for public page: /p/[slug]
  isPublicPageEnabled: boolean('is_public_page_enabled').default(true), // Can be disabled by user
  publicPageSettings: text('public_page_settings'), // JSON: { showPhases: true, showProgress: true, showTimeline: false, genericLabels: true }

  // Status and progress
  status: projectStatusEnum('status').default('discovery'),
  currentPhaseId: uuid('current_phase_id'),
  overallProgress: integer('overall_progress').default(0), // 0-100

  // Stack detection (from package.json)
  detectedStack: text('detected_stack'), // JSON: { framework, database, auth, ui, payments }

  // PRD and planning
  prdContent: text('prd_content'), // Full PRD markdown
  discoveryAnswers: text('discovery_answers'), // JSON: User's answers to discovery questions

  // AI Configuration
  aiModel: text('ai_model').default('claude-sonnet'),
  patternsUsed: text('patterns_used'), // JSON array of pattern names

  // Resource tracking totals
  totalApiCalls: integer('total_api_calls').default(0),
  totalTokensUsed: integer('total_tokens_used').default(0),
  totalFilesCreated: integer('total_files_created').default(0),
  totalFilesModified: integer('total_files_modified').default(0),
  totalTestsRun: integer('total_tests_run').default(0),
  totalTestsPassed: integer('total_tests_passed').default(0),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  lastActivityAt: timestamp('last_activity_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Phases - Phases within a project build
export const projectPhases = pgTable('project_phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),

  // Phase info
  phaseNumber: integer('phase_number').notNull(),
  phaseName: text('phase_name').notNull(), // e.g., "Foundation", "Authentication", "Core Features"
  phaseDescription: text('phase_description'),

  // Status
  status: phaseStatusEnum('status').default('pending'),
  progress: integer('progress').default(0), // 0-100

  // Patterns to use for this phase
  requiredPatterns: text('required_patterns'), // JSON array

  // AI confidence and notes
  aiConfidence: integer('ai_confidence'), // 0-100
  aiNotes: text('ai_notes'), // AI's reasoning for this phase
  alternativesConsidered: text('alternatives_considered'), // JSON: What else was considered

  // Approval checkpoint
  requiresApproval: boolean('requires_approval').default(false),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'), // Could be user ID or 'auto'

  // Resource tracking for this phase
  apiCallsUsed: integer('api_calls_used').default(0),
  tokensUsed: integer('tokens_used').default(0),

  // Timestamps
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedDuration: integer('estimated_duration'), // Minutes (AI estimate)
  actualDuration: integer('actual_duration'), // Minutes
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Features - Individual features within phases
export const projectFeatures = pgTable('project_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseId: uuid('phase_id').references(() => projectPhases.id, { onDelete: 'cascade' }).notNull(),

  // Feature info
  featureName: text('feature_name').notNull(),
  featureDescription: text('feature_description'),
  featureType: text('feature_type'), // e.g., "Authentication", "Form", "API Endpoint"

  // Status
  status: featureStatusEnum('status').default('pending'),
  blockedReason: text('blocked_reason'),

  // Files involved
  filesCreated: text('files_created'), // JSON array of file paths
  filesModified: text('files_modified'), // JSON array of file paths

  // Patterns used
  patternsApplied: text('patterns_applied'), // JSON array

  // AI metadata
  aiConfidence: integer('ai_confidence'),
  aiReasoning: text('ai_reasoning'),

  // Timestamps
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Events - Timeline of everything that happened
export const projectEvents = pgTable('project_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseId: uuid('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  featureId: uuid('feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  // Event details
  eventType: eventTypeEnum('event_type').notNull(),
  eventTitle: text('event_title').notNull(), // Human-readable title
  eventDescription: text('event_description'),
  eventData: text('event_data'), // JSON with event-specific data

  // For file events
  filePath: text('file_path'),
  fileAction: text('file_action'), // create, modify, delete
  linesChanged: integer('lines_changed'),

  // For AI decisions
  aiConfidence: integer('ai_confidence'),
  alternativesConsidered: text('alternatives_considered'), // JSON

  // For risk flags
  riskLevel: riskLevelEnum('risk_level'),
  riskReason: text('risk_reason'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Test Runs - Test execution tracking
export const projectTestRuns = pgTable('project_test_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseId: uuid('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  featureId: uuid('feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  // Test info
  testType: text('test_type').notNull(), // unit, integration, e2e, playwright, vitest
  testCommand: text('test_command'), // The command that was run

  // Results
  passed: boolean('passed').notNull(),
  totalTests: integer('total_tests').default(0),
  passedTests: integer('passed_tests').default(0),
  failedTests: integer('failed_tests').default(0),
  skippedTests: integer('skipped_tests').default(0),

  // Output
  stdout: text('stdout'),
  stderr: text('stderr'),
  failureDetails: text('failure_details'), // JSON array of failed test details

  // Duration
  durationMs: integer('duration_ms'),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Files - File tree tracking for evolution visualization
export const projectFiles = pgTable('project_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),

  // File info
  filePath: text('file_path').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'), // ts, tsx, css, json, md, etc.
  isDirectory: boolean('is_directory').default(false),

  // Metrics
  lineCount: integer('line_count'),
  complexity: integer('complexity'), // Cyclomatic complexity if available

  // Parent tracking for tree structure
  parentPath: text('parent_path'),
  depth: integer('depth').default(0),

  // Status
  status: text('status').default('active'), // active, deleted, renamed
  renamedFrom: text('renamed_from'),

  // Which feature created/modified this
  createdByFeatureId: uuid('created_by_feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  modifiedAt: timestamp('modified_at'),
  deletedAt: timestamp('deleted_at'),
});

// Project Dependencies - Dependency graph tracking
export const projectDependencies = pgTable('project_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),

  // Source file/component
  sourceFile: text('source_file').notNull(),
  sourceType: text('source_type'), // component, service, api, hook, util

  // Target file/component it depends on
  targetFile: text('target_file').notNull(),
  targetType: text('target_type'),

  // Dependency type
  dependencyType: text('dependency_type'), // import, api-call, db-query, event
  importName: text('import_name'), // What was imported

  // Created during which feature
  featureId: uuid('feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at').defaultNow(),
});

// Project Snapshots - Rollback points
export const projectSnapshots = pgTable('project_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseId: uuid('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),

  // Snapshot info
  snapshotName: text('snapshot_name').notNull(),
  snapshotDescription: text('snapshot_description'),
  isAutomatic: boolean('is_automatic').default(false), // Auto-created at phase completion

  // Git reference (if using git)
  gitCommitHash: text('git_commit_hash'),
  gitBranch: text('git_branch'),

  // State at snapshot time
  projectState: text('project_state'), // JSON of .codebakers.json at this point
  fileTree: text('file_tree'), // JSON of file tree structure

  // Restored tracking
  wasRestored: boolean('was_restored').default(false),
  restoredAt: timestamp('restored_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Project Docs - Auto-generated documentation
export const projectDocs = pgTable('project_docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  featureId: uuid('feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  // Doc info
  docType: text('doc_type').notNull(), // api, component, service, readme, architecture
  docTitle: text('doc_title').notNull(),
  docPath: text('doc_path'), // Where it was written (if file)

  // Content
  content: text('content').notNull(),
  format: text('format').default('markdown'), // markdown, jsdoc, openapi

  // Auto-update tracking
  isAutoGenerated: boolean('is_auto_generated').default(true),
  lastGeneratedAt: timestamp('last_generated_at').defaultNow(),
  sourceFiles: text('source_files'), // JSON array of files this doc describes

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Resources - Detailed resource usage tracking
export const projectResources = pgTable('project_resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseId: uuid('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  featureId: uuid('feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  // Resource type
  resourceType: text('resource_type').notNull(), // api_call, tokens, time

  // API call tracking
  apiEndpoint: text('api_endpoint'),
  apiMethod: text('api_method'),

  // Token usage
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),

  // Time tracking
  durationMs: integer('duration_ms'),

  // Cost estimate (in millicents - $0.001 = 100)
  estimatedCostMillicents: integer('estimated_cost_millicents'),

  // Metadata
  metadata: text('metadata'), // JSON for additional context

  createdAt: timestamp('created_at').defaultNow(),
});

// Project Risk Flags - Areas needing human review
export const projectRiskFlags = pgTable('project_risk_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  phaseId: uuid('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  featureId: uuid('feature_id').references(() => projectFeatures.id, { onDelete: 'set null' }),

  // Risk info
  riskLevel: riskLevelEnum('risk_level').notNull(),
  riskCategory: text('risk_category').notNull(), // security, performance, complexity, external-dep
  riskTitle: text('risk_title').notNull(),
  riskDescription: text('risk_description'),

  // What triggered the flag
  triggerFile: text('trigger_file'),
  triggerCode: text('trigger_code'), // Code snippet that triggered
  triggerReason: text('trigger_reason'),

  // AI recommendation
  aiRecommendation: text('ai_recommendation'),

  // Resolution
  isResolved: boolean('is_resolved').default(false),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for project tracking
export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  phases: many(projectPhases),
  features: many(projectFeatures),
  events: many(projectEvents),
  testRuns: many(projectTestRuns),
  files: many(projectFiles),
  dependencies: many(projectDependencies),
  snapshots: many(projectSnapshots),
  docs: many(projectDocs),
  resources: many(projectResources),
  riskFlags: many(projectRiskFlags),
}));

export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  features: many(projectFeatures),
  events: many(projectEvents),
  testRuns: many(projectTestRuns),
  snapshots: many(projectSnapshots),
  resources: many(projectResources),
  riskFlags: many(projectRiskFlags),
}));

export const projectFeaturesRelations = relations(projectFeatures, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectFeatures.projectId],
    references: [projects.id],
  }),
  phase: one(projectPhases, {
    fields: [projectFeatures.phaseId],
    references: [projectPhases.id],
  }),
  events: many(projectEvents),
  testRuns: many(projectTestRuns),
  files: many(projectFiles),
  dependencies: many(projectDependencies),
  docs: many(projectDocs),
  resources: many(projectResources),
  riskFlags: many(projectRiskFlags),
}));

// Types for project tracking
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type NewProjectPhase = typeof projectPhases.$inferInsert;
export type ProjectFeature = typeof projectFeatures.$inferSelect;
export type NewProjectFeature = typeof projectFeatures.$inferInsert;
export type ProjectEvent = typeof projectEvents.$inferSelect;
export type NewProjectEvent = typeof projectEvents.$inferInsert;
export type ProjectTestRun = typeof projectTestRuns.$inferSelect;
export type NewProjectTestRun = typeof projectTestRuns.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type ProjectDependency = typeof projectDependencies.$inferSelect;
export type NewProjectDependency = typeof projectDependencies.$inferInsert;
export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type NewProjectSnapshot = typeof projectSnapshots.$inferInsert;
export type ProjectDoc = typeof projectDocs.$inferSelect;
export type NewProjectDoc = typeof projectDocs.$inferInsert;
export type ProjectResource = typeof projectResources.$inferSelect;
export type NewProjectResource = typeof projectResources.$inferInsert;
export type ProjectRiskFlag = typeof projectRiskFlags.$inferSelect;
export type NewProjectRiskFlag = typeof projectRiskFlags.$inferInsert;

// ============================================
// SERVER-SIDE ENFORCEMENT v6.0
// ============================================

// Enforcement Session Status enum
export const enforcementSessionStatusEnum = pgEnum('enforcement_session_status', [
  'active',      // Session in progress
  'completed',   // Both gates passed
  'failed',      // END gate failed
  'expired',     // Session timed out without END gate
]);

// Enforcement Sessions - Track AI coding sessions with gate compliance
export const enforcementSessions = pgTable('enforcement_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who is this for
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  deviceHash: text('device_hash'), // For trial users without team

  // Session identification
  sessionToken: text('session_token').notNull().unique(), // Generated token for this session
  projectHash: text('project_hash'), // Hash of project for context
  projectName: text('project_name'),

  // Task context from discover_patterns call
  task: text('task').notNull(), // What the AI is working on
  plannedFiles: text('planned_files'), // JSON array of files AI plans to modify
  keywords: text('keywords'), // JSON array of search keywords

  // Gate compliance
  startGatePassed: boolean('start_gate_passed').default(true), // discover_patterns was called
  startGateAt: timestamp('start_gate_at').defaultNow(),
  endGatePassed: boolean('end_gate_passed').default(false), // validate_complete was called
  endGateAt: timestamp('end_gate_at'),

  // Patterns discovered and returned
  patternsReturned: text('patterns_returned'), // JSON array of pattern names returned
  codeExamplesReturned: integer('code_examples_returned').default(0),

  // Validation results (when END gate called)
  validationPassed: boolean('validation_passed'),
  validationIssues: text('validation_issues'), // JSON array of issues found
  testsRun: boolean('tests_run').default(false),
  testsPassed: boolean('tests_passed'),
  typescriptPassed: boolean('typescript_passed'),

  // Session status
  status: enforcementSessionStatusEnum('status').default('active'),

  // Timing
  expiresAt: timestamp('expires_at').notNull(), // Sessions expire after 2 hours
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Pattern Discoveries - Log each discover_patterns call for analytics
export const patternDiscoveries = pgTable('pattern_discoveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => enforcementSessions.id, { onDelete: 'cascade' }).notNull(),

  // What was searched
  task: text('task').notNull(),
  keywords: text('keywords'), // JSON array

  // What was found
  patternsMatched: text('patterns_matched'), // JSON array of { pattern, relevance }
  codebaseMatches: text('codebase_matches'), // JSON array of { file, snippet, pattern }

  // Response metrics
  responseTimeMs: integer('response_time_ms'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Pattern Validations - Log each validate_complete call
export const patternValidations = pgTable('pattern_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => enforcementSessions.id, { onDelete: 'cascade' }).notNull(),

  // Feature being validated
  featureName: text('feature_name').notNull(),
  featureDescription: text('feature_description'),

  // What was checked
  filesModified: text('files_modified'), // JSON array
  testsWritten: text('tests_written'), // JSON array of test file paths

  // Results
  passed: boolean('passed').notNull(),
  issues: text('issues'), // JSON array of { type, message, severity }

  // Individual checks
  startGateVerified: boolean('start_gate_verified'), // Was discover_patterns called?
  testsExist: boolean('tests_exist'),
  testsPass: boolean('tests_pass'),
  typescriptCompiles: boolean('typescript_compiles'),

  // Response metrics
  responseTimeMs: integer('response_time_ms'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for enforcement
export const enforcementSessionsRelations = relations(enforcementSessions, ({ one, many }) => ({
  team: one(teams, {
    fields: [enforcementSessions.teamId],
    references: [teams.id],
  }),
  apiKey: one(apiKeys, {
    fields: [enforcementSessions.apiKeyId],
    references: [apiKeys.id],
  }),
  discoveries: many(patternDiscoveries),
  validations: many(patternValidations),
}));

export const patternDiscoveriesRelations = relations(patternDiscoveries, ({ one }) => ({
  session: one(enforcementSessions, {
    fields: [patternDiscoveries.sessionId],
    references: [enforcementSessions.id],
  }),
}));

export const patternValidationsRelations = relations(patternValidations, ({ one }) => ({
  session: one(enforcementSessions, {
    fields: [patternValidations.sessionId],
    references: [enforcementSessions.id],
  }),
}));

// Types for enforcement
export type EnforcementSession = typeof enforcementSessions.$inferSelect;
export type NewEnforcementSession = typeof enforcementSessions.$inferInsert;
export type PatternDiscovery = typeof patternDiscoveries.$inferSelect;
export type NewPatternDiscovery = typeof patternDiscoveries.$inferInsert;
export type PatternValidation = typeof patternValidations.$inferSelect;
export type NewPatternValidation = typeof patternValidations.$inferInsert;
export type EnforcementSessionStatus = 'active' | 'completed' | 'failed' | 'expired';

// ============================================
// v6.1 ENHANCEMENTS - Quality & Consistency
// ============================================

// Industry Profile enum
export const industryProfileEnum = pgEnum('industry_profile', [
  'general',     // Default, no special requirements
  'healthcare',  // HIPAA patterns
  'finance',     // PCI, SOX patterns
  'legal',       // Privacy, contract patterns
  'ecommerce',   // Product, cart, order patterns
  'education',   // LMS, COPPA patterns
  'enterprise',  // SSO, RBAC, audit patterns
]);

// Strictness Level enum
export const strictnessLevelEnum = pgEnum('strictness_level', [
  'relaxed',    // Minimal validation, fast iteration
  'standard',   // Default CodeBakers patterns
  'strict',     // Extra validation, security checks
  'enterprise', // Maximum validation, compliance
]);

// Team Profiles - Industry-specific and strictness settings
export const teamProfiles = pgTable('team_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull().unique(),

  // Industry configuration
  industryProfile: industryProfileEnum('industry_profile').default('general'),

  // Strictness settings
  strictnessLevel: strictnessLevelEnum('strictness_level').default('standard'),

  // Required patterns (always include these)
  requiredPatterns: text('required_patterns'), // JSON array: ["audit-logging", "error-handling"]

  // Banned patterns (never allow these)
  bannedPatterns: text('banned_patterns'), // JSON array: ["console-log", "any-type"]

  // Custom rules (additional validation)
  customRules: text('custom_rules'), // JSON: { "max-file-size": 500, "require-tests": true }

  // Compliance requirements
  requireHipaa: boolean('require_hipaa').default(false),
  requirePci: boolean('require_pci').default(false),
  requireSoc2: boolean('require_soc2').default(false),
  requireGdpr: boolean('require_gdpr').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Memory - Persistent architectural decisions per project
export const projectMemory = pgTable('project_memory', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Project identification
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  projectHash: text('project_hash').notNull(),
  projectName: text('project_name'),

  // Unique constraint: one memory per team+project
  // Will be enforced via unique index

  // Stack decisions (locked after first detection)
  stackDecisions: text('stack_decisions'), // JSON: { auth: "supabase", orm: "drizzle", ui: "shadcn" }

  // Naming conventions
  namingConventions: text('naming_conventions'), // JSON: { components: "PascalCase", files: "kebab-case" }

  // Architectural patterns in use
  architecturePatterns: text('architecture_patterns'), // JSON: { api: "server-actions", state: "zustand" }

  // File structure decisions
  fileStructure: text('file_structure'), // JSON: { style: "feature-based", testLocation: "colocated" }

  // Custom project rules
  projectRules: text('project_rules'), // JSON: custom rules for this project

  // Dependencies locked (prevent switching)
  lockedDependencies: text('locked_dependencies'), // JSON: ["zustand", "drizzle-orm"]

  // Last detected conflicts
  detectedConflicts: text('detected_conflicts'), // JSON array of conflicts found

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Pattern Compliance - Track how well AI follows patterns
export const patternCompliance = pgTable('pattern_compliance', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => enforcementSessions.id, { onDelete: 'cascade' }).notNull(),

  // Overall score (0-100)
  complianceScore: integer('compliance_score').notNull(),

  // Pattern-by-pattern breakdown
  patternScores: text('pattern_scores'), // JSON: { "error-handling": 90, "loading-states": 60 }

  // Deductions
  deductions: text('deductions'), // JSON array: [{ rule, issue, file, line, points }]

  // What was checked
  filesAnalyzed: text('files_analyzed'), // JSON array
  patternsChecked: text('patterns_checked'), // JSON array

  // Structural matching results
  structuralMatches: text('structural_matches'), // JSON: { pattern, matched, expected, found }

  // Test quality metrics
  testQuality: text('test_quality'), // JSON: { exists, coverage, hasHappyPath, hasErrorCases, hasBoundary }

  createdAt: timestamp('created_at').defaultNow(),
});

// Production Feedback - Errors from production that improve patterns
export const productionFeedback = pgTable('production_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Project identification
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  projectHash: text('project_hash'),
  projectName: text('project_name'),

  // Error details
  errorType: text('error_type').notNull(), // e.g., "TypeError", "NetworkError"
  errorMessage: text('error_message').notNull(),
  errorStack: text('error_stack'),

  // Where it happened
  errorFile: text('error_file'),
  errorLine: integer('error_line'),
  errorFunction: text('error_function'),

  // Pattern context
  patternUsed: text('pattern_used'), // Which pattern was in use when error occurred
  sessionId: uuid('session_id').references(() => enforcementSessions.id, { onDelete: 'set null' }),

  // Frequency tracking
  occurrenceCount: integer('occurrence_count').default(1),
  firstSeenAt: timestamp('first_seen_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at').defaultNow(),

  // Source (how was this reported)
  source: text('source'), // 'sentry', 'manual', 'cli', 'webhook'
  sourceEventId: text('source_event_id'), // External ID from Sentry etc.

  // Resolution
  isResolved: boolean('is_resolved').default(false),
  resolution: text('resolution'),
  patternUpdated: boolean('pattern_updated').default(false),
  resolvedAt: timestamp('resolved_at'),

  // Impact assessment
  impactLevel: text('impact_level'), // 'low', 'medium', 'high', 'critical'
  usersAffected: integer('users_affected'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Architecture Conflicts - Detected conflicting patterns in projects
export const architectureConflicts = pgTable('architecture_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => enforcementSessions.id, { onDelete: 'cascade' }),

  // Project context
  projectHash: text('project_hash'),

  // Conflict details
  conflictType: text('conflict_type').notNull(), // 'state-management', 'styling', 'auth', 'orm'
  conflictingItems: text('conflicting_items').notNull(), // JSON array: ["redux", "zustand"]

  // Where found
  filesInvolved: text('files_involved'), // JSON array of file paths

  // Recommendation
  recommendedItem: text('recommended_item'), // Which one to keep
  recommendationReason: text('recommendation_reason'),

  // Resolution
  isResolved: boolean('is_resolved').default(false),
  resolvedWith: text('resolved_with'), // Which item was chosen
  resolvedAt: timestamp('resolved_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Test Quality Metrics - Detailed test analysis
export const testQualityMetrics = pgTable('test_quality_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => enforcementSessions.id, { onDelete: 'cascade' }),

  // Overall metrics
  overallScore: integer('overall_score'), // 0-100

  // Coverage
  coveragePercent: integer('coverage_percent'),
  linesTotal: integer('lines_total'),
  linesCovered: integer('lines_covered'),

  // Test types present
  hasUnitTests: boolean('has_unit_tests').default(false),
  hasIntegrationTests: boolean('has_integration_tests').default(false),
  hasE2eTests: boolean('has_e2e_tests').default(false),

  // Test cases analysis
  hasHappyPath: boolean('has_happy_path').default(false),
  hasErrorCases: boolean('has_error_cases').default(false),
  hasBoundaryCases: boolean('has_boundary_cases').default(false),
  hasEdgeCases: boolean('has_edge_cases').default(false),

  // Test file analysis
  testFiles: text('test_files'), // JSON array of test file paths
  testCount: integer('test_count').default(0),

  // Recommendations
  missingTests: text('missing_tests'), // JSON array: ["error case for invalid input", "boundary test for max length"]
  recommendations: text('recommendations'), // JSON array of suggestions

  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for new tables
export const teamProfilesRelations = relations(teamProfiles, ({ one }) => ({
  team: one(teams, {
    fields: [teamProfiles.teamId],
    references: [teams.id],
  }),
}));

export const patternComplianceRelations = relations(patternCompliance, ({ one }) => ({
  session: one(enforcementSessions, {
    fields: [patternCompliance.sessionId],
    references: [enforcementSessions.id],
  }),
}));

export const productionFeedbackRelations = relations(productionFeedback, ({ one }) => ({
  team: one(teams, {
    fields: [productionFeedback.teamId],
    references: [teams.id],
  }),
  session: one(enforcementSessions, {
    fields: [productionFeedback.sessionId],
    references: [enforcementSessions.id],
  }),
}));

export const architectureConflictsRelations = relations(architectureConflicts, ({ one }) => ({
  session: one(enforcementSessions, {
    fields: [architectureConflicts.sessionId],
    references: [enforcementSessions.id],
  }),
}));

export const testQualityMetricsRelations = relations(testQualityMetrics, ({ one }) => ({
  session: one(enforcementSessions, {
    fields: [testQualityMetrics.sessionId],
    references: [enforcementSessions.id],
  }),
}));

// Types for new tables
export type TeamProfile = typeof teamProfiles.$inferSelect;
export type NewTeamProfile = typeof teamProfiles.$inferInsert;
export type ProjectMemory = typeof projectMemory.$inferSelect;
export type NewProjectMemory = typeof projectMemory.$inferInsert;
export type PatternCompliance = typeof patternCompliance.$inferSelect;
export type NewPatternCompliance = typeof patternCompliance.$inferInsert;
export type ProductionFeedback = typeof productionFeedback.$inferSelect;
export type NewProductionFeedback = typeof productionFeedback.$inferInsert;
export type ArchitectureConflict = typeof architectureConflicts.$inferSelect;
export type NewArchitectureConflict = typeof architectureConflicts.$inferInsert;
export type TestQualityMetric = typeof testQualityMetrics.$inferSelect;
export type NewTestQualityMetric = typeof testQualityMetrics.$inferInsert;
export type IndustryProfile = 'general' | 'healthcare' | 'finance' | 'legal' | 'ecommerce' | 'education' | 'enterprise';
export type StrictnessLevel = 'relaxed' | 'standard' | 'strict' | 'enterprise';

// ============================================
// ENGINEERING SESSIONS - Agent-Based Build System
// ============================================

// Engineering Session Status enum
export const engineeringSessionStatusEnum = pgEnum('engineering_session_status', [
  'active',     // Session in progress
  'paused',     // Paused by user or admin
  'completed',  // All phases completed successfully
  'abandoned',  // User abandoned or session expired
]);

// Engineering Phase enum (matches EngineeringPhase type)
export const engineeringPhaseEnum = pgEnum('engineering_phase', [
  'scoping',
  'requirements',
  'architecture',
  'design_review',
  'implementation',
  'code_review',
  'testing',
  'security_review',
  'documentation',
  'staging',
  'launch',
]);

// Agent Role enum
export const agentRoleEnum = pgEnum('agent_role', [
  'orchestrator',
  'pm',
  'architect',
  'engineer',
  'qa',
  'security',
  'documentation',
  'devops',
]);

// Gate Status enum
export const gateStatusEnum = pgEnum('gate_status', [
  'pending',
  'in_progress',
  'passed',
  'failed',
  'skipped',
]);

// Engineering Sessions - Main session tracking for AI builds
export const engineeringSessions = pgTable('engineering_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),

  // Project identification
  projectHash: text('project_hash').notNull(),
  projectName: text('project_name').notNull(),
  projectDescription: text('project_description'),

  // Current state
  status: engineeringSessionStatusEnum('status').default('active'),
  currentPhase: engineeringPhaseEnum('current_phase').default('scoping'),
  currentAgent: agentRoleEnum('current_agent').default('orchestrator'),
  isRunning: boolean('is_running').default(true),

  // Scope from wizard (JSON)
  scope: text('scope'), // JSON: ProjectScope

  // Stack decisions (JSON)
  stack: text('stack'), // JSON: { framework, database, orm, auth, ui, payments }

  // Gate statuses (JSON) - Record<EngineeringPhase, GateStatus>
  gateStatus: text('gate_status'), // JSON: { scoping: { status, passedAt, ... }, ... }

  // Accumulated artifacts (JSON)
  artifacts: text('artifacts'), // JSON: { prd, techSpec, apiDocs, ... }

  // Generated files (JSON array) - Actual code files to be written by CLI
  generatedFiles: text('generated_files'), // JSON: [{ id, path, content, type }]

  // Dependency graph (JSON)
  dependencyGraph: text('dependency_graph'), // JSON: { nodes, edges }

  // Error tracking
  lastError: text('last_error'),
  errorCount: integer('error_count').default(0),

  // Resource tracking
  totalApiCalls: integer('total_api_calls').default(0),
  totalTokensUsed: integer('total_tokens_used').default(0),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow(),
  pausedAt: timestamp('paused_at'),
  completedAt: timestamp('completed_at'),
  lastActivityAt: timestamp('last_activity_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Engineering Messages - Agent communication log
export const engineeringMessages = pgTable('engineering_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => engineeringSessions.id, { onDelete: 'cascade' }).notNull(),

  // Message details
  fromAgent: text('from_agent').notNull(), // AgentRole or 'user'
  toAgent: text('to_agent').notNull(), // AgentRole or 'user' or 'all'
  messageType: text('message_type').notNull(), // request, response, review, approval, rejection, question, update, handoff

  // Content
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON: additional context

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

// Engineering Decisions - Architectural decisions made during build
export const engineeringDecisions = pgTable('engineering_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => engineeringSessions.id, { onDelete: 'cascade' }).notNull(),

  // Decision context
  agent: agentRoleEnum('agent').notNull(),
  phase: engineeringPhaseEnum('phase').notNull(),

  // Decision details
  decision: text('decision').notNull(), // What was decided
  reasoning: text('reasoning').notNull(), // Why this decision
  alternatives: text('alternatives'), // JSON array: What else was considered
  confidence: integer('confidence'), // 0-100
  reversible: boolean('reversible').default(true),
  impact: text('impact'), // low, medium, high, critical

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

// Engineering Gate History - Track gate transitions
export const engineeringGateHistory = pgTable('engineering_gate_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => engineeringSessions.id, { onDelete: 'cascade' }).notNull(),

  // Gate details
  phase: engineeringPhaseEnum('phase').notNull(),
  previousStatus: gateStatusEnum('previous_status'),
  newStatus: gateStatusEnum('new_status').notNull(),

  // Who/what triggered the transition
  triggeredBy: text('triggered_by'), // 'user', 'auto', or agent role
  reason: text('reason'),

  // Artifacts produced at this gate
  artifacts: text('artifacts'), // JSON array of artifact names

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for engineering tables
export const engineeringSessionsRelations = relations(engineeringSessions, ({ one, many }) => ({
  team: one(teams, {
    fields: [engineeringSessions.teamId],
    references: [teams.id],
  }),
  messages: many(engineeringMessages),
  decisions: many(engineeringDecisions),
  gateHistory: many(engineeringGateHistory),
}));

export const engineeringMessagesRelations = relations(engineeringMessages, ({ one }) => ({
  session: one(engineeringSessions, {
    fields: [engineeringMessages.sessionId],
    references: [engineeringSessions.id],
  }),
}));

export const engineeringDecisionsRelations = relations(engineeringDecisions, ({ one }) => ({
  session: one(engineeringSessions, {
    fields: [engineeringDecisions.sessionId],
    references: [engineeringSessions.id],
  }),
}));

export const engineeringGateHistoryRelations = relations(engineeringGateHistory, ({ one }) => ({
  session: one(engineeringSessions, {
    fields: [engineeringGateHistory.sessionId],
    references: [engineeringSessions.id],
  }),
}));

// Types for engineering tables
export type EngineeringSession = typeof engineeringSessions.$inferSelect;
export type NewEngineeringSession = typeof engineeringSessions.$inferInsert;
export type EngineeringMessage = typeof engineeringMessages.$inferSelect;
export type NewEngineeringMessage = typeof engineeringMessages.$inferInsert;
export type EngineeringDecision = typeof engineeringDecisions.$inferSelect;
export type NewEngineeringDecision = typeof engineeringDecisions.$inferInsert;
export type EngineeringGateHistory = typeof engineeringGateHistory.$inferSelect;
export type NewEngineeringGateHistory = typeof engineeringGateHistory.$inferInsert;
export type EngineeringSessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type EngineeringPhaseType = 'scoping' | 'requirements' | 'architecture' | 'design_review' | 'implementation' | 'code_review' | 'testing' | 'security_review' | 'documentation' | 'staging' | 'launch';
export type AgentRoleType = 'orchestrator' | 'pm' | 'architect' | 'engineer' | 'qa' | 'security' | 'documentation' | 'devops';
export type GateStatusType = 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';

// ============================================
// E-COMMERCE / PAYMENT TRACKING TABLES
// ============================================

// Payment Event Type enum
export const paymentEventTypeEnum = pgEnum('payment_event_type', [
  'subscription_created',
  'subscription_activated',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_suspended',
  'payment_completed',
  'payment_failed',
  'payment_refunded',
  'invoice_created',
  'invoice_paid',
  'trial_started',
  'trial_converted',
  'trial_expired',
]);

// Payment Events - Track all payment/subscription events from webhooks
export const paymentEvents = pgTable('payment_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Event identification
  eventType: paymentEventTypeEnum('event_type').notNull(),
  provider: paymentProviderEnum('provider').notNull(),
  providerEventId: text('provider_event_id'), // Stripe/PayPal/Square event ID

  // Associated entities
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),

  // Financial data
  amount: integer('amount'), // In cents
  currency: text('currency').default('USD'),

  // Plan info
  plan: subscriptionPlanEnum('plan'),
  previousPlan: subscriptionPlanEnum('previous_plan'),

  // Provider-specific IDs
  subscriptionId: text('subscription_id'),
  invoiceId: text('invoice_id'),
  customerId: text('customer_id'),

  // Event metadata
  metadata: text('metadata'), // JSON: Additional event data
  rawEvent: text('raw_event'), // JSON: Full webhook payload for debugging

  // Processing status
  processed: boolean('processed').default(true),
  processingError: text('processing_error'),

  // Timestamps
  eventTimestamp: timestamp('event_timestamp'), // When the event occurred (from provider)
  createdAt: timestamp('created_at').defaultNow(),
});

// Admin Settings - System configuration
export const adminSettings = pgTable('admin_settings', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Setting identification
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  type: text('type').default('string'), // string, number, boolean, json

  // Metadata
  description: text('description'),
  category: text('category').default('general'), // general, email, limits, features

  // Audit
  updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Audit Logs - Track admin actions
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who performed the action
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  userEmail: text('user_email'),

  // What action was performed
  action: text('action').notNull(), // e.g., 'user.update', 'team.delete', 'setting.change'
  resource: text('resource').notNull(), // e.g., 'user', 'team', 'setting'
  resourceId: text('resource_id'), // ID of the affected resource

  // Change details
  previousValue: text('previous_value'), // JSON: State before change
  newValue: text('new_value'), // JSON: State after change

  // Request context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for payment events
export const paymentEventsRelations = relations(paymentEvents, ({ one }) => ({
  team: one(teams, {
    fields: [paymentEvents.teamId],
    references: [teams.id],
  }),
  profile: one(profiles, {
    fields: [paymentEvents.profileId],
    references: [profiles.id],
  }),
}));

// Relations for audit logs
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(profiles, {
    fields: [auditLogs.userId],
    references: [profiles.id],
  }),
}));

// Types for e-commerce tables
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type NewAdminSetting = typeof adminSettings.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type PaymentEventType = 'subscription_created' | 'subscription_activated' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_expired' | 'subscription_suspended' | 'payment_completed' | 'payment_failed' | 'payment_refunded' | 'invoice_created' | 'invoice_paid' | 'trial_started' | 'trial_converted' | 'trial_expired';
