import { db } from '@/db';
import {
  enforcementSessions,
  patternDiscoveries,
  patternValidations,
  NewEnforcementSession,
  EnforcementSession,
} from '@/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { ContentService } from './content-service';
import { ContextLoaderService } from './context-loader-service';
import { DecisionLogService } from './decision-log-service';
import { AttemptTrackerService } from './attempt-tracker-service';
import { ScopeLockService } from './scope-lock-service';

// Session expiry: 2 hours
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;

// Keyword to pattern mapping - routes to focused snippets
const KEYWORD_PATTERN_MAP: Record<string, string[]> = {
  // =========================================================================
  // AUTH SNIPPETS
  // =========================================================================
  auth: ['auth/email-password.md', 'auth/session.md', 'auth/protected-route.md'],
  login: ['auth/email-password.md', 'auth/session.md'],
  signup: ['auth/email-password.md'],
  'sign-up': ['auth/email-password.md'],
  register: ['auth/email-password.md'],
  password: ['auth/email-password.md', 'auth/password-reset.md'],
  'forgot-password': ['auth/password-reset.md'],
  'reset-password': ['auth/password-reset.md'],
  session: ['auth/session.md'],
  oauth: ['auth/oauth-google.md'],
  google: ['auth/oauth-google.md'],
  'magic-link': ['auth/magic-link.md'],
  passwordless: ['auth/magic-link.md'],
  '2fa': ['auth/two-factor.md'],
  'two-factor': ['auth/two-factor.md'],
  mfa: ['auth/two-factor.md'],
  totp: ['auth/two-factor.md'],
  protected: ['auth/protected-route.md'],
  authorize: ['auth/protected-route.md'],

  // =========================================================================
  // DATABASE SNIPPETS
  // =========================================================================
  database: ['database/schema.md', 'database/crud.md'],
  drizzle: ['database/schema.md', 'database/crud.md'],
  postgres: ['database/schema.md'],
  sql: ['database/crud.md'],
  schema: ['database/schema.md', 'database/relations.md'],
  migration: ['database/migrations.md'],
  migrate: ['database/migrations.md'],
  query: ['database/crud.md', 'database/relations.md'],
  crud: ['database/crud.md'],
  insert: ['database/crud.md'],
  update: ['database/crud.md'],
  delete: ['database/crud.md', 'database/soft-delete.md'],
  'soft-delete': ['database/soft-delete.md'],
  restore: ['database/soft-delete.md'],
  relations: ['database/relations.md'],
  join: ['database/relations.md'],
  transaction: ['database/transactions.md'],
  atomic: ['database/transactions.md'],

  // =========================================================================
  // API SNIPPETS
  // =========================================================================
  api: ['api/error-handling.md', 'api/input-validation.md'],
  route: ['api/error-handling.md', 'api/middleware.md'],
  endpoint: ['api/error-handling.md', 'api/input-validation.md'],
  rest: ['api/error-handling.md'],
  validation: ['api/input-validation.md'],
  zod: ['api/input-validation.md'],
  'rate-limit': ['api/rate-limiting.md'],
  ratelimit: ['api/rate-limiting.md'],
  throttle: ['api/rate-limiting.md'],
  upload: ['api/file-upload.md'],
  file: ['api/file-upload.md'],
  pagination: ['api/pagination.md'],
  cursor: ['api/pagination.md'],
  middleware: ['api/middleware.md'],
  cache: ['api/caching.md'],
  redis: ['api/caching.md'],
  error: ['api/error-handling.md'],

  // =========================================================================
  // FRONTEND SNIPPETS
  // =========================================================================
  react: ['frontend/data-fetching.md', 'frontend/loading-states.md'],
  component: ['frontend/loading-states.md', 'frontend/error-boundary.md'],
  form: ['frontend/form-validation.md'],
  'form-validation': ['frontend/form-validation.md'],
  'react-hook-form': ['frontend/form-validation.md'],
  loading: ['frontend/loading-states.md'],
  skeleton: ['frontend/loading-states.md'],
  spinner: ['frontend/loading-states.md'],
  'error-boundary': ['frontend/error-boundary.md'],
  fetch: ['frontend/data-fetching.md'],
  swr: ['frontend/data-fetching.md'],
  'server-action': ['frontend/data-fetching.md'],
  optimistic: ['frontend/optimistic-update.md'],
  'optimistic-update': ['frontend/optimistic-update.md'],
  modal: ['frontend/modal.md'],
  dialog: ['frontend/modal.md'],
  toast: ['frontend/toast.md'],
  notification: ['frontend/toast.md'],
  alert: ['frontend/toast.md'],

  // =========================================================================
  // PAYMENT SNIPPETS
  // =========================================================================
  payment: ['payments/checkout.md', 'payments/subscription.md'],
  stripe: ['payments/checkout.md', 'payments/subscription.md', 'payments/webhook.md'],
  subscription: ['payments/subscription.md'],
  recurring: ['payments/subscription.md'],
  billing: ['payments/subscription.md', 'payments/customer-portal.md'],
  checkout: ['payments/checkout.md'],
  'customer-portal': ['payments/customer-portal.md'],
  portal: ['payments/customer-portal.md'],
  refund: ['payments/refund.md'],
  'stripe-webhook': ['payments/webhook.md'],

  // =========================================================================
  // LEGACY PATTERNS (still supported for now)
  // =========================================================================
  // Voice/VAPI keywords
  voice: ['06a-voice.md', '25c-voice-vapi.md'],
  vapi: ['06a-voice.md', '25c-voice-vapi.md'],
  call: ['06a-voice.md'],
  phone: ['06a-voice.md'],

  // Email keywords
  email: ['06b-email.md', '28-email-design.md'],
  resend: ['06b-email.md'],
  nylas: ['06b-email.md'],
  smtp: ['06b-email.md'],

  // Integration keywords
  wordpress: ['06g-wordpress.md'],
  cms: ['06g-wordpress.md'],
  integration: ['06f-api-patterns.md'],
  webhook: ['payments/webhook.md', '06f-api-patterns.md'],

  // Testing keywords
  test: ['08-testing.md'],
  playwright: ['08-testing.md'],
  vitest: ['08-testing.md'],

  // Design keywords
  ui: ['09-design.md'],
  design: ['09-design.md'],
  dashboard: ['09-design.md'],
  layout: ['09a-layouts.md'],
  accessibility: ['09b-accessibility.md'],
  seo: ['09c-seo.md'],

  // AI keywords
  ai: ['14-ai.md'],
  openai: ['14-ai.md'],
  anthropic: ['14-ai.md'],
  llm: ['14-ai.md'],
  embedding: ['14-ai.md'],

  // Environment keywords
  env: ['35-environment.md'],
  environment: ['35-environment.md'],
  secret: ['35-environment.md'],
  config: ['35-environment.md'],
};

export interface DiscoverPatternsInput {
  task: string;
  files?: string[];
  keywords?: string[];
  projectHash?: string;
  projectName?: string;
  // Safety system integration
  sessionId?: string; // For tracking safety state
  contextLoaded?: boolean; // Whether load_context was called
  scopeConfirmed?: boolean; // Whether user confirmed scope
}

export interface DiscoverPatternsResult {
  sessionToken: string;
  sessionId: string; // v6.1: Include session ID for conflict tracking
  expiresAt: Date; // v6.1: Include expiry for client display
  patterns: Array<{
    name: string;
    relevance: 'high' | 'medium' | 'low';
    content: string;
  }>;
  coreRules: string; // Always include core rules
  message: string;
  // Pattern match info
  hasExactMatch: boolean;
  relatedSuggestions?: Array<{ pattern: string; reason: string }>;
  // Safety system additions
  safetyWarnings?: string[];
  contextSummary?: string;
  relevantDecisions?: string[];
  failedApproaches?: string[];
}

export interface ValidateCompleteInput {
  sessionToken: string;
  featureName: string;
  featureDescription?: string;
  filesModified?: string[];
  testsWritten?: string[];
  testsRun?: boolean;
  testsPassed?: boolean;
  typescriptPassed?: boolean;
  // Safety system integration
  safetySessionId?: string; // For tracking safety state
  contextWasLoaded?: boolean; // Whether load_context was called
  intentWasClarified?: boolean; // Whether user confirmed understanding
  scopeWasLocked?: boolean; // Whether scope was defined
  approach?: string; // What approach was used (for attempt tracking)
  // Environment & schema validation (v3.9.17)
  envVarsAdded?: string[]; // New env vars added during implementation
  schemaModified?: boolean; // Whether database schema was modified
}

export interface ValidateCompleteResult {
  passed: boolean;
  issues: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  sessionCompleted: boolean;
  message: string;
  // Safety system additions
  safetyScore?: number; // 0-100 based on gates followed
  safetyGatesFollowed?: string[];
  safetyGatesSkipped?: string[];
  attemptLogged?: boolean;
  decisionLogged?: boolean;
}

export class EnforcementService {
  /**
   * START GATE: discover_patterns
   * Creates a new enforcement session and returns relevant patterns
   *
   * SAFETY INTEGRATION: Now includes warnings if context wasn't loaded
   * and includes relevant decisions/failed approaches from context.
   */
  static async discoverPatterns(
    input: DiscoverPatternsInput,
    auth: { teamId?: string; apiKeyId?: string; deviceHash?: string }
  ): Promise<DiscoverPatternsResult> {
    const startTime = Date.now();
    const safetyWarnings: string[] = [];

    // Safety check: Was context loaded?
    if (!input.contextLoaded && input.sessionId) {
      safetyWarnings.push(
        '⚠️ SAFETY WARNING: load_context was not called before discover_patterns. ' +
        'You may be missing important context about decisions and failed approaches.'
      );
    }

    // Safety check: Was scope confirmed?
    if (!input.scopeConfirmed) {
      safetyWarnings.push(
        '⚠️ SAFETY WARNING: User has not confirmed scope. ' +
        'Consider calling clarify_intent to ensure you understand the request correctly.'
      );
    }

    // Get cached context if available
    let contextSummary: string | undefined;
    let relevantDecisions: string[] = [];
    let failedApproaches: string[] = [];

    if (input.sessionId) {
      const cachedContext = ContextLoaderService.getCachedContext(input.sessionId);
      if (cachedContext) {
        // Include relevant decisions
        const decisions = DecisionLogService.getRelevantDecisions(
          cachedContext.decisions,
          input.task
        );
        relevantDecisions = decisions.map(d => `${d.decision}: ${d.reasoning}`);

        // Include failed approaches for this type of task
        const failed = cachedContext.recentAttempts.filter(a =>
          a.result === 'failure' &&
          a.shouldNotRetry &&
          a.issue.toLowerCase().includes(input.task.toLowerCase().split(' ')[0])
        );
        failedApproaches = failed.map(a => `${a.approach}: ${a.errorMessage || 'Failed'}`);

        // Generate context summary
        contextSummary = ContextLoaderService.formatContextForPrompt(cachedContext);
      }
    }

    // Extract keywords from task if not provided
    const keywords = input.keywords || this.extractKeywords(input.task);

    // Find relevant patterns based on keywords
    const patternResult = this.findPatternsByKeywords(keywords);
    const patternNames = patternResult.patterns;

    // Always include 00-core
    if (!patternNames.includes('00-core.md')) {
      patternNames.unshift('00-core.md');
    }

    // Get content from database
    const content = await ContentService.getEncodedContent();
    const modules = content.modules || {};

    // Build patterns array with content
    const patterns: DiscoverPatternsResult['patterns'] = [];
    for (const name of patternNames) {
      if (modules[name]) {
        patterns.push({
          name,
          relevance: name === '00-core.md' ? 'high' : 'medium',
          content: modules[name],
        });
      }
    }

    // Generate session token
    const sessionToken = `ses_${randomUUID().replace(/-/g, '')}`;

    // Create enforcement session
    const sessionData: NewEnforcementSession = {
      teamId: auth.teamId || null,
      apiKeyId: auth.apiKeyId || null,
      deviceHash: auth.deviceHash || null,
      sessionToken,
      projectHash: input.projectHash || null,
      projectName: input.projectName || null,
      task: input.task,
      plannedFiles: input.files ? JSON.stringify(input.files) : null,
      keywords: JSON.stringify(keywords),
      startGatePassed: true,
      patternsReturned: JSON.stringify(patternNames),
      codeExamplesReturned: patterns.length,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    };

    const [session] = await db.insert(enforcementSessions).values(sessionData).returning();

    // Log discovery
    await db.insert(patternDiscoveries).values({
      sessionId: session.id,
      task: input.task,
      keywords: JSON.stringify(keywords),
      patternsMatched: JSON.stringify(patternNames.map((name) => ({ pattern: name, relevance: 'medium' }))),
      responseTimeMs: Date.now() - startTime,
    });

    // Build message with safety context
    let message = `Found ${patterns.length} relevant patterns. You MUST follow these patterns when implementing "${input.task}". Your session token is ${sessionToken} - use this when calling validate_complete.`;

    // Add note about pattern match type
    if (!patternResult.hasExactMatch && patternResult.relatedSuggestions) {
      message += `\n\n## ⚠️ NO EXACT PATTERN MATCH\n`;
      message += `No specific pattern exists for "${input.task}". Using general patterns, but consider these related patterns:\n`;
      for (const suggestion of patternResult.relatedSuggestions) {
        message += `- **${suggestion.pattern}**: ${suggestion.reason}\n`;
      }
    }

    // Add safety warnings to message
    if (safetyWarnings.length > 0) {
      message = safetyWarnings.join('\n') + '\n\n' + message;
    }

    // Add relevant decisions to message
    if (relevantDecisions.length > 0) {
      message += `\n\n## ACTIVE DECISIONS (Must follow):\n${relevantDecisions.map(d => `- ${d}`).join('\n')}`;
    }

    // Add failed approaches to message
    if (failedApproaches.length > 0) {
      message += `\n\n## FAILED APPROACHES (Do not retry):\n${failedApproaches.map(a => `- ${a}`).join('\n')}`;
    }

    return {
      sessionToken,
      sessionId: session.id,
      expiresAt: sessionData.expiresAt,
      patterns,
      coreRules: modules['00-core.md'] || '',
      message,
      // Pattern match info
      hasExactMatch: patternResult.hasExactMatch,
      relatedSuggestions: patternResult.relatedSuggestions,
      // Safety system additions
      safetyWarnings: safetyWarnings.length > 0 ? safetyWarnings : undefined,
      contextSummary,
      relevantDecisions: relevantDecisions.length > 0 ? relevantDecisions : undefined,
      failedApproaches: failedApproaches.length > 0 ? failedApproaches : undefined,
    };
  }

  /**
   * END GATE: validate_complete
   * Validates that the AI followed patterns and tests pass
   *
   * SAFETY INTEGRATION: Now tracks safety gates followed/skipped,
   * logs attempts to the tracker, and records decisions.
   */
  static async validateComplete(input: ValidateCompleteInput): Promise<ValidateCompleteResult> {
    const startTime = Date.now();
    const issues: ValidateCompleteResult['issues'] = [];
    const safetyGatesFollowed: string[] = [];
    const safetyGatesSkipped: string[] = [];

    // Find the session
    const session = await db.query.enforcementSessions.findFirst({
      where: eq(enforcementSessions.sessionToken, input.sessionToken),
    });

    if (!session) {
      return {
        passed: false,
        issues: [
          {
            type: 'SESSION_NOT_FOUND',
            message:
              'No active session found with this token. You must call discover_patterns BEFORE writing code to get a session token.',
            severity: 'error',
          },
        ],
        sessionCompleted: false,
        message: 'VALIDATION FAILED: No session found. You did not call discover_patterns first.',
        safetyScore: 0,
        safetyGatesFollowed: [],
        safetyGatesSkipped: ['discover_patterns', 'load_context', 'clarify_intent', 'define_scope'],
      };
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      await db
        .update(enforcementSessions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(enforcementSessions.id, session.id));

      return {
        passed: false,
        issues: [
          {
            type: 'SESSION_EXPIRED',
            message: 'Session has expired. Call discover_patterns again to start a new session.',
            severity: 'error',
          },
        ],
        sessionCompleted: false,
        message: 'VALIDATION FAILED: Session expired. Start a new session with discover_patterns.',
        safetyScore: 0,
      };
    }

    // Check if session already completed
    if (session.status === 'completed') {
      return {
        passed: true,
        issues: [],
        sessionCompleted: true,
        message: 'This session was already validated successfully.',
        safetyScore: 100,
      };
    }

    // =========================================================================
    // SAFETY GATE CHECKS
    // =========================================================================

    // Gate 1: discover_patterns (already checked via session existence)
    // This is the REQUIRED gate for the two-gate system
    if (session.startGatePassed) {
      safetyGatesFollowed.push('discover_patterns');
    } else {
      safetyGatesSkipped.push('discover_patterns');
      issues.push({
        type: 'START_GATE_NOT_PASSED',
        message: 'discover_patterns was not properly called before writing code.',
        severity: 'error',
      });
    }

    // =========================================================================
    // OPTIONAL SAFETY GATES (only check if using enhanced safety system)
    // These gates are part of the extended safety system, not the core two-gate system.
    // Only add warnings if safetySessionId is provided (user is using safety tools).
    // =========================================================================
    const usingEnhancedSafety = !!input.safetySessionId;

    // Gate 2: load_context (optional - enhanced safety only)
    if (input.contextWasLoaded) {
      safetyGatesFollowed.push('load_context');
    } else if (usingEnhancedSafety) {
      // Only warn if user is explicitly using the safety system
      safetyGatesSkipped.push('load_context');
      issues.push({
        type: 'CONTEXT_NOT_LOADED',
        message: 'load_context was not called. You may have missed important decisions or failed approaches.',
        severity: 'warning',
      });
    }

    // Gate 3: clarify_intent (optional - enhanced safety only)
    if (input.intentWasClarified) {
      safetyGatesFollowed.push('clarify_intent');
    } else if (usingEnhancedSafety) {
      // Only warn if user is explicitly using the safety system
      safetyGatesSkipped.push('clarify_intent');
      issues.push({
        type: 'INTENT_NOT_CLARIFIED',
        message: 'clarify_intent was not called. You may have misunderstood the user\'s request.',
        severity: 'warning',
      });
    }

    // Gate 4: define_scope (optional - enhanced safety only)
    if (input.scopeWasLocked) {
      safetyGatesFollowed.push('define_scope');
    } else if (usingEnhancedSafety) {
      // Only warn if user is explicitly using the safety system
      safetyGatesSkipped.push('define_scope');
      issues.push({
        type: 'SCOPE_NOT_LOCKED',
        message: 'define_scope was not called. There was no scope lock to prevent scope creep.',
        severity: 'warning',
      });
    }

    // =========================================================================
    // STANDARD VALIDATION CHECKS
    // =========================================================================

    // Check if tests were run
    if (!input.testsRun) {
      issues.push({
        type: 'TESTS_NOT_RUN',
        message: 'Tests must be run before completing a feature. Run npm test.',
        severity: 'error',
      });
    }

    // Check if tests passed
    if (input.testsRun && !input.testsPassed) {
      issues.push({
        type: 'TESTS_FAILED',
        message: 'Tests are failing. Fix all test failures before completing.',
        severity: 'error',
      });
    }

    // Check if TypeScript compiled
    if (input.typescriptPassed === false) {
      issues.push({
        type: 'TYPESCRIPT_ERROR',
        message: 'TypeScript has compilation errors. Run npx tsc --noEmit to see errors.',
        severity: 'error',
      });
    }

    // Check if tests were written (warning only)
    if (!input.testsWritten || input.testsWritten.length === 0) {
      issues.push({
        type: 'NO_TESTS_WRITTEN',
        message: 'No test files were specified. Features should include tests.',
        severity: 'warning',
      });
    }

    // =========================================================================
    // ENVIRONMENT & SCHEMA VALIDATION CHECKS (v3.9.17)
    // =========================================================================

    // Check for new env vars that might need validation
    if (input.envVarsAdded && input.envVarsAdded.length > 0) {
      // Warn if env vars were added but .env.example might not be updated
      issues.push({
        type: 'ENV_VARS_ADDED',
        message: `New environment variables detected: ${input.envVarsAdded.join(', ')}. Ensure they are documented in .env.example and have validation in lib/env.ts`,
        severity: 'warning',
      });
    }

    // Check for schema changes that might need migrations
    if (input.schemaModified) {
      issues.push({
        type: 'SCHEMA_MODIFIED',
        message: 'Database schema was modified. Run `npm run db:generate` and `npm run db:migrate` to apply changes.',
        severity: 'warning',
      });
    }

    // =========================================================================
    // CALCULATE RESULTS
    // =========================================================================

    // Determine if validation passed (errors = fail, warnings = pass with warnings)
    const hasErrors = issues.some((i) => i.severity === 'error');
    const passed = !hasErrors;

    // Calculate safety score (0-100)
    // For basic two-gate system: discover_patterns = 100%
    // For enhanced safety system: each gate = 25%
    let safetyScore: number;
    if (usingEnhancedSafety) {
      // Enhanced safety: 4 gates, each worth 25 points
      safetyScore = safetyGatesFollowed.length * 25;
    } else {
      // Basic two-gate: discover_patterns alone = 100%
      safetyScore = session.startGatePassed ? 100 : 0;
    }

    // =========================================================================
    // LOG ATTEMPT TO TRACKER (for future reference)
    // =========================================================================

    let attemptLogged = false;
    let decisionLogged = false;

    if (input.safetySessionId) {
      // Log the attempt
      const attempt = AttemptTrackerService.createAttempt({
        issue: session.task || input.featureName,
        approach: input.approach || `Implemented ${input.featureName}`,
        codeOrCommand: input.filesModified?.join(', ') || '',
        result: passed ? 'success' : 'failure',
        errorMessage: passed ? undefined : issues.filter(i => i.severity === 'error').map(i => i.message).join('; '),
        lessonsLearned: passed
          ? `Successfully implemented using patterns: ${JSON.parse(session.patternsReturned || '[]').join(', ')}`
          : undefined,
      });

      // Add to cache for this session
      const { AttemptCache } = await import('./attempt-tracker-service');
      AttemptCache.add(input.safetySessionId, attempt);
      attemptLogged = true;

      // Log the decision if successful
      if (passed) {
        const decision = DecisionLogService.createDecision({
          decision: `Completed: ${input.featureName}`,
          category: 'business-logic',
          reasoning: `Implementation passed all validation checks. Files: ${input.filesModified?.join(', ') || 'none specified'}`,
          alternativesConsidered: [],
          madeBy: 'ai',
          userApproved: false,
          impact: 'medium',
        });

        const { DecisionCache } = await import('./decision-log-service');
        DecisionCache.add(input.safetySessionId, decision);
        decisionLogged = true;
      }
    }

    // =========================================================================
    // UPDATE SESSION
    // =========================================================================

    const newStatus = passed ? 'completed' : 'failed';
    await db
      .update(enforcementSessions)
      .set({
        endGatePassed: passed,
        endGateAt: new Date(),
        validationPassed: passed,
        validationIssues: JSON.stringify(issues),
        testsRun: input.testsRun || false,
        testsPassed: input.testsPassed || false,
        typescriptPassed: input.typescriptPassed ?? null,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(enforcementSessions.id, session.id));

    // Log validation
    await db.insert(patternValidations).values({
      sessionId: session.id,
      featureName: input.featureName,
      featureDescription: input.featureDescription || null,
      filesModified: input.filesModified ? JSON.stringify(input.filesModified) : null,
      testsWritten: input.testsWritten ? JSON.stringify(input.testsWritten) : null,
      passed,
      issues: JSON.stringify(issues),
      startGateVerified: session.startGatePassed,
      testsExist: (input.testsWritten?.length || 0) > 0,
      testsPass: input.testsPassed || false,
      typescriptCompiles: input.typescriptPassed ?? null,
      responseTimeMs: Date.now() - startTime,
    });

    // =========================================================================
    // BUILD RESULT MESSAGE
    // =========================================================================

    let message = passed
      ? `✅ VALIDATION PASSED: Feature "${input.featureName}" completed successfully.`
      : `❌ VALIDATION FAILED: Fix the following issues:\n${issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.message}`).join('\n')}`;

    // Add safety score feedback
    if (safetyScore < 100) {
      message += `\n\n📊 Safety Score: ${safetyScore}/100`;
      if (safetyGatesSkipped.length > 0) {
        message += `\n⚠️ Skipped gates: ${safetyGatesSkipped.join(', ')}`;
        message += `\nFor better reliability, use all safety gates in future tasks.`;
      }
    } else {
      message += `\n\n📊 Safety Score: 100/100 - All gates followed!`;
    }

    return {
      passed,
      issues,
      sessionCompleted: passed,
      message,
      safetyScore,
      safetyGatesFollowed,
      safetyGatesSkipped,
      attemptLogged,
      decisionLogged,
    };
  }

  /**
   * Get patterns by name (for /api/patterns/get endpoint)
   */
  static async getPatterns(
    patternNames: string[]
  ): Promise<Array<{ name: string; content: string; found: boolean }>> {
    const content = await ContentService.getEncodedContent();
    const modules = content.modules || {};

    return patternNames.map((name) => ({
      name,
      content: modules[name] || '',
      found: !!modules[name],
    }));
  }

  /**
   * Get active session for a team/device
   */
  static async getActiveSession(auth: {
    teamId?: string;
    deviceHash?: string;
  }): Promise<EnforcementSession | null> {
    const conditions = [];

    if (auth.teamId) {
      conditions.push(eq(enforcementSessions.teamId, auth.teamId));
    }
    if (auth.deviceHash) {
      conditions.push(eq(enforcementSessions.deviceHash, auth.deviceHash));
    }

    if (conditions.length === 0) return null;

    const session = await db.query.enforcementSessions.findFirst({
      where: and(...conditions, eq(enforcementSessions.status, 'active'), gt(enforcementSessions.expiresAt, new Date())),
      orderBy: [desc(enforcementSessions.createdAt)],
    });

    return session || null;
  }

  /**
   * Get session by token
   */
  static async getSessionByToken(token: string): Promise<EnforcementSession | null> {
    const session = await db.query.enforcementSessions.findFirst({
      where: eq(enforcementSessions.sessionToken, token),
    });

    return session || null;
  }

  /**
   * Extract keywords from a task description
   */
  private static extractKeywords(task: string): string[] {
    const lowercaseTask = task.toLowerCase();
    const keywords: string[] = [];

    // Check for all known keywords
    for (const keyword of Object.keys(KEYWORD_PATTERN_MAP)) {
      if (lowercaseTask.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    // If no keywords found, try some generic ones based on common words
    if (keywords.length === 0) {
      if (lowercaseTask.includes('add') || lowercaseTask.includes('create') || lowercaseTask.includes('build')) {
        keywords.push('component', 'api'); // General patterns
      }
    }

    return keywords;
  }

  /**
   * Find patterns based on keywords
   * Returns matched patterns and related suggestions if no exact match
   */
  private static findPatternsByKeywords(keywords: string[]): {
    patterns: string[];
    hasExactMatch: boolean;
    relatedSuggestions?: Array<{ pattern: string; reason: string }>;
  } {
    const patternSet = new Set<string>();

    for (const keyword of keywords) {
      const patterns = KEYWORD_PATTERN_MAP[keyword.toLowerCase()];
      if (patterns) {
        for (const pattern of patterns) {
          patternSet.add(pattern);
        }
      }
    }

    // If patterns found, return them
    if (patternSet.size > 0) {
      return {
        patterns: Array.from(patternSet),
        hasExactMatch: true,
      };
    }

    // No exact match - provide related suggestions based on task category
    const relatedSuggestions: Array<{ pattern: string; reason: string }> = [];
    const taskLower = keywords.join(' ').toLowerCase();

    // Third-party API integrations
    if (taskLower.includes('api') || taskLower.includes('integrate') ||
        taskLower.includes('connect') || taskLower.includes('third') ||
        taskLower.includes('external') || taskLower.includes('webhook')) {
      relatedSuggestions.push({
        pattern: '06f-api-patterns.md',
        reason: 'General patterns for third-party API integrations',
      });
    }

    // Background/async work
    if (taskLower.includes('background') || taskLower.includes('job') ||
        taskLower.includes('queue') || taskLower.includes('cron') ||
        taskLower.includes('scheduled') || taskLower.includes('async')) {
      relatedSuggestions.push({
        pattern: '06d-background-jobs.md',
        reason: 'Patterns for background jobs and scheduled tasks',
      });
    }

    // Document generation
    if (taskLower.includes('pdf') || taskLower.includes('document') ||
        taskLower.includes('excel') || taskLower.includes('word') ||
        taskLower.includes('export') || taskLower.includes('report')) {
      relatedSuggestions.push({
        pattern: '06e-documents.md',
        reason: 'Patterns for generating PDFs, Excel, and Word documents',
      });
    }

    // Real-time features
    if (taskLower.includes('realtime') || taskLower.includes('real-time') ||
        taskLower.includes('live') || taskLower.includes('socket') ||
        taskLower.includes('notification') || taskLower.includes('push')) {
      relatedSuggestions.push({
        pattern: '11-realtime.md',
        reason: 'Patterns for WebSockets and real-time updates',
      });
    }

    // AI/LLM features
    if (taskLower.includes('ai') || taskLower.includes('gpt') ||
        taskLower.includes('llm') || taskLower.includes('chat') ||
        taskLower.includes('generate') || taskLower.includes('prompt')) {
      relatedSuggestions.push({
        pattern: '14-ai.md',
        reason: 'Patterns for AI/LLM integrations',
      });
    }

    // If still no suggestions, fall back to core patterns
    if (relatedSuggestions.length === 0) {
      relatedSuggestions.push({
        pattern: '04-frontend.md',
        reason: 'General frontend component patterns',
      });
      relatedSuggestions.push({
        pattern: '03-api.md',
        reason: 'General API route patterns',
      });
    }

    return {
      patterns: ['04-frontend.md', '03-api.md'], // Default patterns
      hasExactMatch: false,
      relatedSuggestions,
    };
  }
}
